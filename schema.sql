-- =====================================================================
-- FunnyHouse — tablas de Supabase
-- ---------------------------------------------------------------------
-- Pega esto entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- Todas las tablas llevan el prefijo fh_ para no mezclarse con Despensar.
-- =====================================================================

-- Miembros de la familia. role = 'admin' (puede aprobar, dar puntos,
-- crear premios y gestionar la familia) o 'member'.
create table if not exists fh_members (
  id          text primary key,
  home        text not null,
  name        text not null,
  role        text not null default 'member',
  color       text,
  emoji       text,
  pin_hash    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tareas de casa y de estudios.
-- kind = 'casa' | 'estudio'; freq = 'none' | 'daily' | 'weekdays' | 'weekly'
create table if not exists fh_tasks (
  id          text primary key,
  home        text not null,
  title       text not null,
  kind        text not null default 'casa',
  study_type  text,
  subject     text,
  assignee    text,
  points      integer not null default 0,
  freq        text not null default 'none',
  due         date,
  needs_ok    boolean not null default true,
  notes       text,
  grade       text,
  created_by  text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Cada vez que alguien completa una tarea (una fila por tarea y periodo).
-- status = 'pending' (esperando revisión) | 'ok' | 'no'
create table if not exists fh_done (
  id          text primary key,
  home        text not null,
  task_id     text not null,
  member_id   text,
  period      text not null,
  status      text not null default 'pending',
  points      integer not null default 0,
  reviewed_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Catálogo de premios.
create table if not exists fh_rewards (
  id          text primary key,
  home        text not null,
  title       text not null,
  emoji       text,
  cost        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Premios pedidos / canjeados.
create table if not exists fh_claims (
  id          text primary key,
  home        text not null,
  reward_id   text,
  member_id   text,
  title       text,
  cost        integer not null default 0,
  status      text not null default 'pending',
  reviewed_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Libro de puntos: cada suma o resta queda apuntada aquí.
create table if not exists fh_points (
  id          text primary key,
  home        text not null,
  member_id   text not null,
  delta       integer not null,
  reason      text,
  given_by    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Turnos rotativos: lista de ids de miembros separados por comas, en orden,
-- y la fecha en la que le toca al primero. (Se puede ejecutar aunque ya
-- tuvieras las tablas creadas: solo añade lo que falte.)
alter table fh_tasks add column if not exists rotation  text;
alter table fh_tasks add column if not exists rot_start date;

-- «Todos»: lista de ids de miembros que tienen que hacer la tarea CADA UNO
-- (hacer la cama, lavarse los dientes…). Si está vacía, es una tarea normal.
alter table fh_tasks add column if not exists team text;

-- Fotos de perfil (una por miembro, id = id del miembro). Van aparte para que
-- la app solo las descargue cuando cambian. Son JPEG pequeños (192 px) en texto.
create table if not exists fh_photos (
  id          text primary key,
  home        text not null,
  photo       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists fh_photos_home on fh_photos (home);

create index if not exists fh_members_home on fh_members (home);
create index if not exists fh_tasks_home   on fh_tasks   (home);
create index if not exists fh_done_home    on fh_done    (home, created_at desc);
create index if not exists fh_rewards_home on fh_rewards (home);
create index if not exists fh_claims_home  on fh_claims  (home);
create index if not exists fh_points_home  on fh_points  (home);

-- Acceso: aquí solo se activa RLS (sin permisos para la clave pública).
-- Quién puede leer y cambiar qué lo decide security.sql: ejecútalo después.
do $$
declare t text;
begin
  foreach t in array array['fh_members','fh_tasks','fh_done','fh_rewards','fh_claims','fh_points','fh_photos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "fh anon" on %I', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
