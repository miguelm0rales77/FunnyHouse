-- =====================================================================
-- FunnyHouse — seguridad en el servidor
-- ---------------------------------------------------------------------
-- Pega esto entero en Supabase → SQL Editor → New query → Run,
-- DESPUÉS de schema.sql. Se puede ejecutar más de una vez.
--
-- Qué cambia:
--  · Nadie puede leer ni escribir las tablas fh_ directamente con la clave
--    pública. Todo pasa por las funciones de abajo.
--  · El PIN se comprueba aquí, se guarda cifrado (bcrypt) y nunca sale del
--    servidor. Tras 5 intentos fallidos, el perfil se bloquea 10 minutos.
--  · Al entrar con el PIN, el móvil recibe un «pase» (token) que se guarda en
--    el móvil. Cambiar el PIN de alguien cierra sus otras sesiones.
--  · Cada cambio se comprueba contra las reglas de la casa (quién puede
--    aprobar, dar puntos, crear premios…), y cada lote de cambios se guarda
--    entero o no se guarda (transacción).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Sesiones de cada móvil y control de intentos de PIN.
create table if not exists fh_sessions (
  token       text primary key,
  home        text not null,
  member_id   text not null,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists fh_sessions_member on fh_sessions (member_id);

create table if not exists fh_pin_fails (
  member_id    text primary key,
  fails        integer not null default 0,
  locked_until timestamptz
);

-- Cerrar el acceso directo: sin políticas RLS y sin permisos para anon.
do $$
declare t text;
begin
  foreach t in array array['fh_members','fh_tasks','fh_done','fh_rewards','fh_claims',
                           'fh_points','fh_photos','fh_sessions','fh_pin_fails'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "fh anon" on %I', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Ayudantes internos (no se pueden llamar desde la app)
-- ---------------------------------------------------------------------
create or replace function fh__deny(i integer, msg text) returns void
language plpgsql as $$
begin
  raise exception 'FH_OP:%:%', i, msg;
end $$;

create or replace function fh__new_token(p_home text, p_member text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tk text := encode(gen_random_bytes(24), 'hex');
begin
  insert into fh_sessions (token, home, member_id) values (tk, p_home, p_member);
  return tk;
end $$;

create or replace function fh__actor(p_token text) returns fh_members
language plpgsql security definer set search_path = public, extensions as $$
declare s fh_sessions; m fh_members;
begin
  select * into s from fh_sessions where token = p_token;
  if s.token is null then raise exception 'FH_AUTH: sesión no válida'; end if;
  select * into m from fh_members where id = s.member_id and home = s.home;
  if m.id is null then
    delete from fh_sessions where token = p_token;
    raise exception 'FH_AUTH: ese perfil ya no existe';
  end if;
  update fh_sessions set last_seen = now() where token = p_token and last_seen < now() - interval '1 hour';
  return m;
end $$;

create or replace function fh__admins(p_home text) returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int from fh_members where home = p_home and role = 'admin';
$$;

revoke all on function fh__deny(integer, text)        from public, anon, authenticated;
revoke all on function fh__new_token(text, text)      from public, anon, authenticated;
revoke all on function fh__actor(text)                from public, anon, authenticated;
revoke all on function fh__admins(text)               from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Antes de entrar: lista de perfiles (sin fotos ni datos privados)
-- ---------------------------------------------------------------------
create or replace function fh_who(p_home text) returns json
language sql security definer set search_path = public stable as $$
  select coalesce(json_agg(json_build_object(
           'id', id, 'home', home, 'name', name, 'role', role, 'color', color, 'emoji', emoji,
           'has_pin', pin_hash is not null, 'created_at', created_at, 'updated_at', updated_at)
         order by created_at), '[]'::json)
  from fh_members where home = p_home;
$$;

-- Entrar con PIN → devuelve un pase para este móvil.
create or replace function fh_login(p_home text, p_member text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare m fh_members; f fh_pin_fails; ok boolean := false;
begin
  select * into m from fh_members where id = p_member and home = p_home;
  if m.id is null then return json_build_object('error', 'Ese perfil ya no existe.'); end if;

  select * into f from fh_pin_fails where member_id = m.id;
  if f.locked_until is not null and f.locked_until > now() then
    return json_build_object('error', 'Demasiados intentos. Espera ' ||
      ceil(extract(epoch from f.locked_until - now()) / 60)::int || ' min.');
  end if;

  if m.pin_hash is null then
    return json_build_object('error', 'Este perfil aún no tiene PIN. Pide a un adulto que te lo ponga en «Familia».');
  end if;

  if m.pin_hash like 's:%' then
    -- PIN guardado por la versión anterior de la app: se comprueba y se pasa a bcrypt
    ok := m.pin_hash = 's:' || encode(digest(m.home || ':' || coalesce(p_pin, ''), 'sha256'), 'hex');
    if ok then update fh_members set pin_hash = crypt(p_pin, gen_salt('bf', 8)) where id = m.id; end if;
  elsif m.pin_hash like '$2%' then
    ok := m.pin_hash = crypt(coalesce(p_pin, ''), m.pin_hash);
  end if;

  if not ok then
    insert into fh_pin_fails as pf (member_id, fails) values (m.id, 1)
      on conflict (member_id) do update set fails = pf.fails + 1;
    update fh_pin_fails set fails = 0, locked_until = now() + interval '10 minutes'
      where member_id = m.id and fails >= 5;
    return json_build_object('error', 'PIN incorrecto');
  end if;

  delete from fh_pin_fails where member_id = m.id;
  return json_build_object('token', fh__new_token(m.home, m.id), 'member', m.id);
end $$;

-- Primer perfil de una casa vacía (será admin).
create or replace function fh_bootstrap(p_home text, p_member jsonb, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare mid text := p_member->>'id'; nm text := btrim(p_member->>'name');
begin
  if p_home is null or length(p_home) < 6 then return json_build_object('error', 'Casa no válida.'); end if;
  perform pg_advisory_xact_lock(hashtext('fh:' || p_home));
  if exists (select 1 from fh_members where home = p_home) then
    return json_build_object('error', 'Esta casa ya tiene miembros: elige tu perfil.');
  end if;
  if coalesce(p_pin, '') !~ '^\d{4,8}$' then return json_build_object('error', 'El PIN tiene que ser de 4 a 8 cifras.'); end if;
  if nm is null or length(nm) not between 1 and 24 then return json_build_object('error', 'Nombre no válido.'); end if;
  if mid is null or length(mid) > 64 then return json_build_object('error', 'Identificador no válido.'); end if;
  insert into fh_members (id, home, name, role, color, emoji, pin_hash)
    values (mid, p_home, nm, 'admin', left(p_member->>'color', 16), left(p_member->>'emoji', 16),
            crypt(p_pin, gen_salt('bf', 8)));
  return json_build_object('token', fh__new_token(p_home, mid), 'member', mid);
end $$;

create or replace function fh_logout(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from fh_sessions where token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Con sesión: leer la casa
-- ---------------------------------------------------------------------
create or replace function fh_load(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a fh_members; h text;
begin
  a := fh__actor(p_token); h := a.home;
  return json_build_object(
    'me', a.id,
    'members', (select coalesce(json_agg(json_build_object(
                  'id', id, 'home', home, 'name', name, 'role', role, 'color', color, 'emoji', emoji,
                  'has_pin', pin_hash is not null, 'created_at', created_at, 'updated_at', updated_at)
                order by created_at), '[]'::json) from fh_members where home = h),
    'tasks',   (select coalesce(json_agg(x), '[]'::json) from fh_tasks x where home = h),
    'done',    (select coalesce(json_agg(x), '[]'::json) from
                  (select * from fh_done where home = h order by created_at desc limit 5000) x),
    'rewards', (select coalesce(json_agg(x), '[]'::json) from fh_rewards x where home = h),
    'claims',  (select coalesce(json_agg(x), '[]'::json) from fh_claims x where home = h),
    'points',  (select coalesce(json_agg(x), '[]'::json) from
                  (select * from fh_points where home = h order by created_at desc limit 5000) x),
    'photos',  (select coalesce(json_object_agg(id, updated_at), '{}'::json) from fh_photos where home = h)
  );
end $$;

create or replace function fh_photos_get(p_token text, p_ids text[]) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a fh_members;
begin
  a := fh__actor(p_token);
  return (select coalesce(json_agg(json_build_object('id', id, 'photo', photo, 'updated_at', updated_at)), '[]'::json)
          from fh_photos where home = a.home and id = any(p_ids));
end $$;

-- ---------------------------------------------------------------------
-- Con sesión: aplicar un lote de cambios. Todo o nada.
-- Cada operación: { table, op: 'upsert'|'delete', key, row }
-- Si una no está permitida, se cancela el lote con «FH_OP:<n>:<motivo>».
-- ---------------------------------------------------------------------
create or replace function fh_apply(p_token text, p_ops jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  a fh_members; h text; adm boolean;
  op jsonb; i integer := -1; tb text; v_kind text; k text; r jsonb; pin text; bal integer;
  em fh_members; vm fh_members;
  et fh_tasks;   vt fh_tasks; t fh_tasks;
  ed fh_done;    vd fh_done;
  vp fh_points;
  vr fh_rewards; rw fh_rewards;
  ec fh_claims;  vc fh_claims;
  ph text;
begin
  a := fh__actor(p_token); h := a.home; adm := a.role = 'admin';
  if jsonb_typeof(p_ops) is distinct from 'array' or jsonb_array_length(p_ops) > 300 then
    raise exception 'FH_OP:0:lote no válido';
  end if;

  for op in select value from jsonb_array_elements(p_ops) loop
    i := i + 1;
    tb := op->>'table'; v_kind := op->>'op'; k := op->>'key'; r := coalesce(op->'row', '{}'::jsonb);
    if coalesce(v_kind, '') not in ('upsert', 'delete') or k is null or length(k) > 200 then perform fh__deny(i, 'operación no válida'); end if;
    if v_kind = 'upsert' and (r->>'id') is distinct from k then perform fh__deny(i, 'id no coincide'); end if;

    -- ===== miembros =====
    if tb = 'fh_members' then
      select * into em from fh_members where id = k and home = h;
      if v_kind = 'delete' then
        if em.id is null then continue; end if;
        if not adm then perform fh__deny(i, 'Solo un admin puede quitar miembros'); end if;
        if k = a.id then perform fh__deny(i, 'No puedes quitarte a ti mismo'); end if;
        if em.role = 'admin' and fh__admins(h) <= 1 then perform fh__deny(i, 'Tiene que quedar al menos un admin'); end if;
        delete from fh_members where id = k and home = h;
        delete from fh_sessions where member_id = k;
        delete from fh_photos where id = k and home = h;
        delete from fh_pin_fails where member_id = k;
      else
        vm := jsonb_populate_record(null::fh_members, r);
        pin := nullif(r->>'new_pin', '');
        if pin is not null and pin !~ '^\d{4,8}$' then perform fh__deny(i, 'El PIN tiene que ser de 4 a 8 cifras'); end if;
        if vm.name is null or length(btrim(vm.name)) not between 1 and 24 then perform fh__deny(i, 'Nombre no válido'); end if;
        if vm.role is null or vm.role not in ('admin', 'member') then vm.role := coalesce(em.role, 'member'); end if;
        if em.id is null then
          if not adm then perform fh__deny(i, 'Solo un admin puede añadir miembros'); end if;
          if pin is null then perform fh__deny(i, 'Cada miembro necesita un PIN'); end if;
          insert into fh_members (id, home, name, role, color, emoji, pin_hash)
            values (k, h, btrim(vm.name), vm.role, left(vm.color, 16), left(vm.emoji, 16), crypt(pin, gen_salt('bf', 8)))
            on conflict (id) do nothing;
        else
          if not adm and k <> a.id then perform fh__deny(i, 'Solo puedes cambiar tu propio perfil'); end if;
          if not adm then vm.role := em.role; end if;
          if em.role = 'admin' and vm.role = 'member' and fh__admins(h) <= 1 then
            perform fh__deny(i, 'Tiene que quedar al menos un admin');
          end if;
          update fh_members set name = btrim(vm.name), role = vm.role, color = left(vm.color, 16), emoji = left(vm.emoji, 16),
                 pin_hash = case when pin is null then pin_hash else crypt(pin, gen_salt('bf', 8)) end,
                 updated_at = now()
           where id = k and home = h;
          if pin is not null then
            delete from fh_sessions where member_id = k and token <> p_token;
            delete from fh_pin_fails where member_id = k;
          end if;
        end if;
      end if;

    -- ===== tareas =====
    elsif tb = 'fh_tasks' then
      select * into et from fh_tasks where id = k and home = h;
      if v_kind = 'delete' then
        if et.id is null then continue; end if;
        if not adm and (et.created_by is distinct from a.id or
            exists (select 1 from fh_done where home = h and task_id = k and status = 'ok')) then
          perform fh__deny(i, 'No puedes borrar esta tarea');
        end if;
        delete from fh_tasks where id = k and home = h;
      else
        vt := jsonb_populate_record(null::fh_tasks, r);
        if vt.title is null or length(btrim(vt.title)) not between 1 and 120 then perform fh__deny(i, 'Título no válido'); end if;
        if not adm then
          if et.id is null then
            vt.assignee := a.id; vt.points := 0; vt.needs_ok := true; vt.rotation := null; vt.rot_start := null;
            vt.created_by := a.id; vt.archived := false;
          elsif et.created_by = a.id then
            if exists (select 1 from fh_done where home = h and task_id = k and status = 'ok') then
              perform fh__deny(i, 'Ya tiene una vez aprobada: pide a un adulto que la cambie');
            end if;
            vt.assignee := et.assignee; vt.points := et.points; vt.needs_ok := et.needs_ok;
            vt.rotation := et.rotation; vt.rot_start := et.rot_start; vt.created_by := et.created_by; vt.archived := et.archived;
          elsif et.assignee = a.id or a.id = any(string_to_array(coalesce(et.rotation, ''), ',')) then
            -- en una tarea de otro, solo puede apuntar la nota del examen
            update fh_tasks set grade = left(vt.grade, 20), updated_at = now() where id = k and home = h;
            continue;
          else
            perform fh__deny(i, 'Solo un admin puede cambiar esta tarea');
          end if;
        end if;
        vt.home := h; vt.updated_at := now(); vt.created_at := coalesce(et.created_at, vt.created_at, now());
        insert into fh_tasks select (vt).*
          on conflict (id) do update set
            (title, kind, study_type, subject, assignee, points, freq, due, needs_ok, notes, grade,
             created_by, archived, rotation, rot_start, updated_at)
          = (excluded.title, excluded.kind, excluded.study_type, excluded.subject, excluded.assignee, excluded.points,
             excluded.freq, excluded.due, excluded.needs_ok, excluded.notes, excluded.grade,
             excluded.created_by, excluded.archived, excluded.rotation, excluded.rot_start, excluded.updated_at)
          where fh_tasks.home = h;
      end if;

    -- ===== tareas hechas =====
    elsif tb = 'fh_done' then
      select * into ed from fh_done where id = k and home = h;
      if v_kind = 'delete' then
        if ed.id is null then continue; end if;
        if not adm and not (ed.member_id = a.id and ed.status = 'pending') then
          perform fh__deny(i, 'Solo puedes desmarcar lo tuyo pendiente de revisar');
        end if;
        delete from fh_done where id = k and home = h;
      else
        vd := jsonb_populate_record(null::fh_done, r);
        select * into t from fh_tasks where id = vd.task_id and home = h;
        if t.id is null then perform fh__deny(i, 'La tarea ya no existe'); end if;
        if k <> t.id || '|' || coalesce(vd.period, '') then perform fh__deny(i, 'Periodo no válido'); end if;
        if not adm then
          if vd.member_id is distinct from a.id then perform fh__deny(i, 'Solo puedes marcar tus tareas'); end if;
          if not (t.assignee is null or t.assignee = a.id or a.id = any(string_to_array(coalesce(t.rotation, ''), ','))) then
            perform fh__deny(i, 'Esta tarea no es tuya');
          end if;
          if ed.status = 'ok' then perform fh__deny(i, 'Ya está aprobada'); end if;
          if ed.status = 'pending' and ed.member_id <> a.id then perform fh__deny(i, 'Ya la marcó otra persona'); end if;
          vd.points := t.points;
          if t.needs_ok then vd.status := 'pending'; vd.reviewed_by := null;
          else vd.status := 'ok'; vd.reviewed_by := a.id; end if;
        end if;
        if vd.status is null or vd.status not in ('pending', 'ok', 'no') then perform fh__deny(i, 'Estado no válido'); end if;
        vd.home := h; vd.updated_at := now(); vd.created_at := coalesce(vd.created_at, now());
        insert into fh_done select (vd).*
          on conflict (id) do update set
            (task_id, member_id, period, status, points, reviewed_by, created_at, updated_at)
          = (excluded.task_id, excluded.member_id, excluded.period, excluded.status, excluded.points,
             excluded.reviewed_by, excluded.created_at, excluded.updated_at)
          where fh_done.home = h;
      end if;

    -- ===== puntos =====
    elsif tb = 'fh_points' then
      if v_kind = 'delete' then
        if not adm then perform fh__deny(i, 'Solo un admin puede quitar puntos'); end if;
        delete from fh_points where id = k and home = h;
      else
        vp := jsonb_populate_record(null::fh_points, r);
        if not adm then
          -- un miembro solo «cobra» una tarea sin revisión que él mismo acaba de completar
          select * into ed from fh_done where id = substr(k, 3) and home = h;
          select * into t from fh_tasks where id = ed.task_id and home = h;
          if left(k, 2) <> 'd|' or ed.id is null or ed.status <> 'ok' or ed.member_id <> a.id
             or t.id is null or t.needs_ok then
            perform fh__deny(i, 'Los puntos los da un adulto');
          end if;
          vp.member_id := a.id; vp.delta := ed.points; vp.given_by := a.id; vp.reason := t.title;
        end if;
        if vp.delta is null or not exists (select 1 from fh_members where id = vp.member_id and home = h) then
          perform fh__deny(i, 'Puntos no válidos');
        end if;
        vp.home := h; vp.updated_at := now(); vp.created_at := coalesce(vp.created_at, now());
        insert into fh_points select (vp).*
          on conflict (id) do update set (member_id, delta, reason, given_by, updated_at)
          = (excluded.member_id, excluded.delta, excluded.reason, excluded.given_by, excluded.updated_at)
          where fh_points.home = h;
      end if;

    -- ===== premios =====
    elsif tb = 'fh_rewards' then
      if not adm then perform fh__deny(i, 'Solo un admin puede cambiar los premios'); end if;
      if v_kind = 'delete' then
        delete from fh_rewards where id = k and home = h;
      else
        vr := jsonb_populate_record(null::fh_rewards, r);
        if vr.title is null or length(btrim(vr.title)) not between 1 and 80 then perform fh__deny(i, 'Título no válido'); end if;
        vr.home := h; vr.updated_at := now(); vr.created_at := coalesce(vr.created_at, now());
        vr.cost := greatest(0, coalesce(vr.cost, 0));
        insert into fh_rewards select (vr).*
          on conflict (id) do update set (title, emoji, cost, updated_at)
          = (excluded.title, excluded.emoji, excluded.cost, excluded.updated_at)
          where fh_rewards.home = h;
      end if;

    -- ===== premios pedidos =====
    elsif tb = 'fh_claims' then
      select * into ec from fh_claims where id = k and home = h;
      if v_kind = 'delete' then
        if ec.id is null then continue; end if;
        if not adm and not (ec.member_id = a.id and ec.status = 'pending') then
          perform fh__deny(i, 'No puedes cancelar este premio');
        end if;
        delete from fh_claims where id = k and home = h;
      else
        vc := jsonb_populate_record(null::fh_claims, r);
        if not adm then
          if ec.id is not null then perform fh__deny(i, 'Ese premio ya está pedido'); end if;
          select * into rw from fh_rewards where id = vc.reward_id and home = h;
          if rw.id is null then perform fh__deny(i, 'Ese premio ya no existe'); end if;
          vc.member_id := a.id; vc.status := 'pending'; vc.cost := rw.cost; vc.title := rw.title; vc.reviewed_by := null;
          select coalesce(sum(delta), 0) into bal from fh_points where home = h and member_id = a.id;
          bal := bal - coalesce((select sum(cost) from fh_claims where home = h and member_id = a.id and status = 'pending'), 0);
          if bal < vc.cost then perform fh__deny(i, 'No te llegan los puntos'); end if;
        end if;
        if vc.status is null or vc.status not in ('pending', 'ok', 'no') then perform fh__deny(i, 'Estado no válido'); end if;
        if not exists (select 1 from fh_members where id = vc.member_id and home = h) then perform fh__deny(i, 'Miembro no válido'); end if;
        vc.home := h; vc.updated_at := now(); vc.created_at := coalesce(vc.created_at, now());
        insert into fh_claims select (vc).*
          on conflict (id) do update set (reward_id, member_id, title, cost, status, reviewed_by, updated_at)
          = (excluded.reward_id, excluded.member_id, excluded.title, excluded.cost, excluded.status,
             excluded.reviewed_by, excluded.updated_at)
          where fh_claims.home = h;
      end if;

    -- ===== fotos (solo admin) =====
    elsif tb = 'fh_photos' then
      if not adm then perform fh__deny(i, 'Solo un admin puede cambiar las fotos'); end if;
      if v_kind = 'delete' then
        delete from fh_photos where id = k and home = h;
      else
        ph := r->>'photo';
        if ph is null or ph !~ '^data:image/(jpeg|png|webp);base64,' or length(ph) > 300000 then
          perform fh__deny(i, 'Foto no válida');
        end if;
        if not exists (select 1 from fh_members where id = k and home = h) then perform fh__deny(i, 'Miembro no válido'); end if;
        insert into fh_photos (id, home, photo, updated_at) values (k, h, ph, now())
          on conflict (id) do update set photo = excluded.photo, updated_at = excluded.updated_at
          where fh_photos.home = h;
      end if;

    else
      perform fh__deny(i, 'Tabla desconocida');
    end if;
  end loop;

  return json_build_object('ok', true, 'n', i + 1);
end $$;

-- Lo único que la app puede llamar con la clave pública:
grant execute on function fh_who(text)                      to anon, authenticated;
grant execute on function fh_login(text, text, text)        to anon, authenticated;
grant execute on function fh_bootstrap(text, jsonb, text)   to anon, authenticated;
grant execute on function fh_logout(text)                   to anon, authenticated;
grant execute on function fh_load(text)                     to anon, authenticated;
grant execute on function fh_photos_get(text, text[])       to anon, authenticated;
grant execute on function fh_apply(text, jsonb)             to anon, authenticated;

-- Que la API vea las funciones nuevas al momento.
notify pgrst, 'reload schema';
