/* =====================================================================
   FunnyHouse — las tareas de casa, los estudios y los premios.
   Misma arquitectura que Despensar: los datos viven en Supabase y el
   móvil guarda una copia (y una cola de cambios) para funcionar sin red.
   ===================================================================== */
(() => {
"use strict";

/* ---------------------------------------------------------------
   0. Configuración
   --------------------------------------------------------------- */
const CFG  = window.FUNNYHOUSE_CONFIG || {};
const BASE = String(CFG.supabaseUrl || "").trim().replace(/\/+$/, "");
const KEY  = String(CFG.supabaseKey || "").trim();
const HOME = String(CFG.home || "casa").trim();
const FORCE_LOCAL = /[?&]local=1\b/.test(location.search);   // ?local=1 → probar sin tocar los datos reales
const REMOTE = !CFG.localOnly && !FORCE_LOCAL && /^https:\/\/.+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 30;
const DESPENSAR = String(CFG.despensarUrl || "").trim();
const APP_VERSION = "6";       // súbelo junto con VERSION de sw.js en cada cambio

/* ---------------------------------------------------------------
   1. Constantes
   --------------------------------------------------------------- */
const TABLES = { members:"fh_members", tasks:"fh_tasks", done:"fh_done", rewards:"fh_rewards", claims:"fh_claims", points:"fh_points" };
const KINDS = Object.keys(TABLES);

const TABS = [
  { id:"hoy", label:"Hoy" }, { id:"casa", label:"Casa" }, { id:"estudios", label:"Estudios" },
  { id:"premios", label:"Premios" }, { id:"familia", label:"Familia" }
];
const FREQ = { none:"Una vez", daily:"Cada día", weekdays:"Entre semana", weekly:"Cada semana" };
const STUDY = { deberes:"Deberes", examen:"Examen", trabajo:"Trabajo", estudiar:"Estudiar", lectura:"Lectura" };
const SUBJECTS = ["Mates","Lengua","Inglés","Ciencias","Sociales","Música","Plástica","Ed. física"];
const IDEAS_CASA = ["Hacer la cama","Poner la mesa","Quitar la mesa","Sacar la basura","Poner el lavavajillas",
  "Recoger la habitación","Tender la ropa","Doblar la ropa","Pasear al perro","Regar las plantas","Aspirar","Limpiar el baño"];
const IDEAS_EST = ["Hacer los deberes","Leer 20 minutos","Repasar para el examen","Preparar la mochila","Practicar inglés"];
const IDEAS_PREMIO = [["🍕","Elegir la cena",60],["🏞️","Elegir el plan del finde",120],["🧁","Cocinar juntos un postre",80],
  ["🎨","Tarde de manualidades",70],["🚲","Excursión en bici",100],["🎲","Noche de juegos de mesa",60],["🎬","Elegir la peli en familia",80],
  ["📚","Un libro nuevo",150],["🛌","Desayuno en la cama",90],["📺","30 min más de pantalla",50],
  ["💶","2 € de paga extra",120]];
const AVATARS = ["🦊","🐼","🐯","🦁","🐸","🐵","🐨","🐰","🦄","🐙","🐧","🐶","🐱","🦖","🐝","🦉","🌟","⚽","🎸","🚀"];
const REWARD_EMOJIS = ["🎁","🍕","🏞️","🧁","🎨","🚲","🎲","🎬","📚","🛌","🍦","⚽","🎢","📺","🎮","💶"];
const COLORS = ["#E0663A","#3F7FD9","#8A4FD1","#2E9E6A","#D4A20F","#D9487A","#14949E","#7A8699"];

const ICONS = {
  hoy:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
  casa:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9"/><path d="M10 20.5v-5.5h4v5.5"/></svg>',
  estudios:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5Z"/></svg>',
  premios:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M12 8.5v12"/><path d="M12 8.5S10.8 4 8.3 4a2.2 2.2 0 0 0 0 4.5"/><path d="M12 8.5S13.2 4 15.7 4a2.2 2.2 0 0 1 0 4.5"/></svg>',
  familia:'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8" r="3.2"/><path d="M2.8 19.5a5.7 5.7 0 0 1 11.4 0"/><circle cx="17" cy="9.2" r="2.5"/><path d="M15.6 14.3a4.7 4.7 0 0 1 5.9 4.7"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.6 4.5L19 7"/></svg>',
  x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  wait:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5"/><path d="M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5"/></svg>',
  chev:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg>'
};

/* ---------------------------------------------------------------
   2. Estado local
   --------------------------------------------------------------- */
const EMPTY = () => ({ members:[], tasks:[], done:[], rewards:[], claims:[], points:[] });
let state = EMPTY();
let outbox = [];
let tab = "hoy";
let meId = "";
let loaded = !REMOTE;          // hay algo que pintar (datos del servidor o copia guardada)
let confirmed = !REMOTE;       // el servidor ha respondido bien al menos una vez en esta sesión
let loadError = "";            // por qué no se ha podido cargar (si no hay copia guardada)
let filters = { hoy:"", casa:"all", estudios:"all", premios:"" };
let lastPainted = "";

const NS = "funnyhouse." + (REMOTE ? "" : "local.");
const CACHE_KEY = NS + "cache." + HOME;
const OUT_KEY   = NS + "outbox." + HOME;
const ME_KEY    = NS + "me." + HOME;
const PHOTO_KEY = NS + "photos." + HOME;
const TOKEN_KEY = NS + "token." + HOME;
/* Pase de sesión que da Supabase al entrar con el PIN (solo con servidor). */
let token = "";
/* Fotos de perfil: { idMiembro: { photo:"data:image/jpeg…", updated_at } }.
   Van aparte del resto del estado: la sincronización solo mira las fechas
   y descarga una foto únicamente cuando ha cambiado. */
let photos = {};
function savePhotos(){ writeLS(PHOTO_KEY, photos); }

function uid(){
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function readLS(k, fb){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch(e){ return fb; } }
function writeLS(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function saveCache(){ writeLS(CACHE_KEY, state); }
function saveOutbox(){ writeLS(OUT_KEY, outbox); }
const nowISO = () => new Date().toISOString();
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

/* ---------------------------------------------------------------
   3. Fechas
   --------------------------------------------------------------- */
function today0(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
function parseDate(iso){
  if (!iso) return null;
  const p = String(iso).slice(0,10).split("-").map(Number);
  if (p.length !== 3 || !p[0]) return null;
  const d = new Date(p[0], p[1]-1, p[2]); d.setHours(0,0,0,0);
  return isNaN(d.getTime()) ? null : d;
}
function toISO(d){ return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function daysUntil(iso){ const d = parseDate(iso); return d === null ? null : Math.round((d - today0()) / 86400000); }
function mondayOf(d){ const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function shortDate(iso){ const d = parseDate(iso); return d ? d.toLocaleDateString("es-ES", { day:"numeric", month:"short" }) : ""; }
function weekday(iso){ const d = parseDate(iso); return d ? d.toLocaleDateString("es-ES", { weekday:"long" }) : ""; }
function dueInfo(iso, exam){
  const n = daysUntil(iso);
  if (n === null) return null;
  let label, cls;
  if (n < 0) {
    label = exam ? "Fue el " + shortDate(iso) : (n === -1 ? "Era para ayer" : "Atrasada " + Math.abs(n) + " días");
    cls = exam ? "" : "gone";
  } else if (n === 0) { label = exam ? "¡Examen hoy!" : "Para hoy"; cls = "today"; }
  else if (n === 1) { label = exam ? "Examen mañana" : "Para mañana"; cls = "today"; }
  else if (n <= 6) { label = (exam ? "Examen el " : "Para el ") + weekday(iso); cls = n <= 3 ? "soon" : ""; }
  else { label = (exam ? "Examen " : "Para el ") + shortDate(iso); cls = ""; }
  return { label, cls, n };
}
function whenLabel(ts){
  const d = new Date(ts); if (isNaN(d)) return "";
  const n = Math.round((today0() - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (n === 0) return "Hoy";
  if (n === 1) return "Ayer";
  if (n < 7) return d.toLocaleDateString("es-ES", { weekday:"long" });
  return d.toLocaleDateString("es-ES", { day:"numeric", month:"short" });
}

/* ---------------------------------------------------------------
   4. Sincronización con Supabase (igual que Despensar)
   --------------------------------------------------------------- */
const statusEl = document.getElementById("status");
let statusTimer = null;
function setStatus(s, text){
  statusEl.dataset.s = s;
  statusEl.textContent = text || "";
  clearTimeout(statusTimer);
  if (s === "idle" && text) statusTimer = setTimeout(() => { statusEl.textContent = ""; }, 2400);
}

function api(path, opts){
  opts = opts || {};
  const ctrl = window.AbortController ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
  return fetch(BASE + "/rest/v1" + path, {
    signal: ctrl ? ctrl.signal : undefined,
    method: opts.method || "GET",
    cache: "no-store",
    // Clave antigua (anon, empieza por eyJ…) va también como Bearer; la nueva
    // (sb_publishable_…) no es un JWT y solo debe ir en «apikey».
    headers: Object.assign({ apikey: KEY, "Content-Type": "application/json" },
      /^eyJ/.test(KEY) ? { Authorization: "Bearer " + KEY } : {}, opts.headers || {}),
    body: opts.body
  }).finally(() => { if (timer) clearTimeout(timer); });
}

/* Llamada a una función segura de Supabase (security.sql). */
async function rpc(fn, args){
  const res = await api("/rpc/" + fn, { method:"POST", body: JSON.stringify(args || {}) });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.message || j.error || text; } catch (e) {}
    const err = new Error(msg || ("HTTP " + res.status));
    err.status = res.status;
    if (/^FH_AUTH/.test(msg)) err.auth = true;
    const m = /^FH_OP:(\d+):([\s\S]*)$/.exec(msg || "");
    if (m) { err.opIndex = Number(m[1]); err.reason = m[2]; }
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function enqueue(job){
  if (!REMOTE) return;
  outbox = outbox.filter((j) => !(j.table === job.table && j.key === job.key));
  outbox.push(job);
  saveOutbox();
  scheduleFlush();
}
let flushTimer = null, flushing = false;
function scheduleFlush(){ clearTimeout(flushTimer); flushTimer = setTimeout(flush, 250); }

/* Envía la cola en lotes. Cada lote se guarda entero o no se guarda.
   Si el servidor rechaza un cambio (no está permitido), se quita solo ese
   y se reenvía el resto; después se recarga para ver la versión buena. */
async function flush(){
  if (!REMOTE || flushing || !outbox.length || !token) return;
  if (!navigator.onLine) { setStatus("offline", "Sin conexión"); return; }
  flushing = true;
  setStatus("saving", "Guardando…");
  try {
    while (outbox.length) {
      const batch = outbox.slice(0, 200);
      try {
        await rpc("fh_apply", { p_token: token,
          p_ops: batch.map((j) => ({ table:j.table, op:j.op, key:j.key, row:j.row || null })) });
        outbox = outbox.filter((j) => !batch.includes(j)); saveOutbox();
      } catch (err) {
        if (err.auth) { sessionLost(); throw err; }
        if (err.status === 404) { bannerDetail = err.message; showBanner("tables"); paintBanner(); throw err; }
        if (err.opIndex !== undefined && batch[err.opIndex]) {
          const bad = batch[err.opIndex];
          outbox = outbox.filter((j) => j !== bad); saveOutbox();
          bannerDetail = err.reason || ""; showBanner("rejected"); paintBanner();
          continue;
        }
        throw err;              // red u otro fallo: se reintenta más tarde
      }
    }
    setStatus("idle", "Guardado");
    hideBanner("offline");
    setTimeout(refresh, 0);        // al terminar de guardar, traer la versión del servidor
  } catch (e) {
    setStatus("offline", navigator.onLine ? "Sin guardar" : "Sin conexión");
    if (!navigator.onLine) showBanner("offline");
  } finally {
    flushing = false;
  }
}

async function refresh(){
  if (!REMOTE || flushing || !navigator.onLine || (token && outbox.length)) return;
  try {
    // Con sesión: toda la casa. Sin sesión: solo la lista de perfiles para elegir.
    const data = token ? await rpc("fh_load", { p_token: token })
                       : { members: await rpc("fh_who", { p_home: HOME }) };
    const next = EMPTY();
    KINDS.forEach((k) => { if (Array.isArray(data[k])) next[k] = data[k]; });
    if (token && data.me && data.me !== meId) { meId = data.me; try { localStorage.setItem(ME_KEY, meId); } catch(e){} }
    const before = JSON.stringify(state);
    state = next;
    saveCache();
    hideBanner("offline"); hideBanner("tables"); hideBanner("noconn");
    const first = !confirmed;
    loaded = true; confirmed = true; loadError = "";
    const photosChanged = token ? await syncPhotos(data.photos || {}) : false;
    if (JSON.stringify(state) !== before || first || photosChanged) render();
    if (first) afterLoad();
  } catch (e) {
    if (e.auth) { sessionLost(); return; }
    if (!navigator.onLine) { setStatus("offline", "Sin conexión"); showBanner("offline"); }
    else if (e.status === 404) { bannerDetail = e.message; showBanner("tables"); paintBanner(); }
    else {
      bannerDetail = e.status ? e.message : (e.name === "AbortError" ? "La conexión tarda demasiado" : "Sin respuesta del servidor");
      if (loaded) { showBanner("noconn"); paintBanner(); }   // sin copia guardada lo explica la pantalla
    }
    if (!loaded) {          // sin copia guardada: explicar en vez de quedarse «cargando»
      loadError = e.status === 404 ? "tables" : (navigator.onLine ? "noconn" : "offline");
      render();
    }
  }
}

/* Fotos: el servidor manda solo { id: fecha }; se descargan las que cambiaron. */
async function syncPhotos(remote){
  try {
    let changed = false;
    Object.keys(photos).forEach((id) => { if (!(id in remote)) { delete photos[id]; changed = true; } });
    const stale = Object.keys(remote).filter((id) => !photos[id] || photos[id].updated_at !== remote[id]);
    if (stale.length) {
      const list = await rpc("fh_photos_get", { p_token: token, p_ids: stale });
      (list || []).forEach((x) => { photos[x.id] = { photo:x.photo, updated_at:x.updated_at }; changed = true; });
    }
    if (changed) savePhotos();
    return changed;
  } catch (e) { return false; }
}
function setPhoto(id, dataUrl){
  if (dataUrl) {
    const row = { id, home:HOME, photo:dataUrl, updated_at:nowISO() };
    photos[id] = { photo:dataUrl, updated_at:row.updated_at };
    enqueue({ table:"fh_photos", op:"upsert", key:id, row });
  } else if (photos[id]) {
    delete photos[id];
    enqueue({ table:"fh_photos", op:"delete", key:id });
  }
  savePhotos();
}

/* --- sesión --- */
function saveToken(){ try { localStorage.setItem(TOKEN_KEY, token); } catch(e){} }
function setSession(tk, id){
  token = tk || ""; saveToken();
  setMe(id || "");
  flush(); refresh();
}
function sessionLost(){
  if (!token) return;
  token = ""; saveToken();
  meId = ""; try { localStorage.setItem(ME_KEY, ""); } catch(e){}
  render();
  toast("Tienes que volver a entrar con tu PIN");
  refresh();
}
async function logout(){
  const tk = token;
  token = ""; saveToken();
  setMe("");
  if (REMOTE && tk) { try { await rpc("fh_logout", { p_token: tk }); } catch(e){} }
  refresh();
}
const hasPin = (m) => !!(m && (m.has_pin || m.pin_hash));

/* Recorta al centro, reduce a 192 px y comprime en JPEG (unos 10-20 KB). */
function resizePhoto(file){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 192, side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas"); c.width = c.height = S;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

/* --- mutaciones --- */
function put(kind, row, quiet){
  row = Object.assign({}, row, { home:HOME, updated_at:nowISO() });
  if (!row.created_at) row.created_at = row.updated_at;
  const local = Object.assign({}, row);
  if ("new_pin" in local) { if (local.new_pin) local.has_pin = true; delete local.new_pin; }
  const list = state[kind];
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = local; else list.unshift(local);
  saveCache();
  enqueue({ table:TABLES[kind], op:"upsert", key:row.id, row });
  if (!quiet) render();
  return row;
}
function drop(kind, id, quiet){
  const had = state[kind].some((x) => x.id === id);
  state[kind] = state[kind].filter((x) => x.id !== id);
  saveCache();
  if (had) enqueue({ table:TABLES[kind], op:"delete", key:id });
  if (!quiet) render();
}

/* --- avisos --- */
const banners = {
  offline:'<strong>Sin conexión.</strong> Puedes seguir marcando tareas: se guardará solo en cuanto vuelvas a tener red.',
  rejected:'<strong>Un cambio no se ha guardado</strong> porque no está permitido. Ya se ha recargado la versión buena.',
  noconn:'<strong>No se ha podido conectar con Supabase.</strong> Lo que ves es la última copia guardada en este móvil; lo que marques se guardará al reconectar. <button class="mini" type="button" data-retry>Reintentar</button>',
  tables:'<strong>Falta preparar Supabase.</strong> Ejecuta <code>schema.sql</code> y después <code>security.sql</code> en el SQL Editor de este proyecto. Tus cambios no se pierden: se guardarán solos.',
  local:'<strong>Modo local.</strong> Los datos se guardan solo en este navegador. Pon <code>localOnly: false</code> en config.js para compartirlos con la familia.'
};
let activeBanner = null;
let bannerDetail = "";
function errMsg(status, body){
  try { const j = JSON.parse(body); return (j.code ? j.code + ": " : "") + (j.message || j.error || body); }
  catch (e) { return "HTTP " + status + (body ? " " + body.slice(0, 160) : ""); }
}
function showBanner(k){ if (activeBanner === k) return; activeBanner = k; paintBanner(); }
function hideBanner(k){ if (activeBanner === k) { activeBanner = null; paintBanner(); } }
function retryNow(){ setStatus("saving", "Conectando…"); if (outbox.length) flush(); else refresh(); }
document.getElementById("bannerSlot").addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) retryNow(); });
function paintBanner(){
  const extra = (activeBanner === "tables" || activeBanner === "rejected" || activeBanner === "noconn") && bannerDetail
    ? '<div class="banner-detail mono">' + esc(bannerDetail) + (activeBanner === "rejected" ? "" : "<br>Proyecto: " + esc(BASE.replace(/^https:\/\//, ""))) + "</div>" : "";
  document.getElementById("bannerSlot").innerHTML = activeBanner ? '<div class="banner">' + banners[activeBanner] + extra + "</div>" : "";
}

/* ---------------------------------------------------------------
   5. Reglas de la casa (quién puede hacer qué)
   --------------------------------------------------------------- */
const member = (id) => state.members.find((m) => m.id === id) || null;
const me = () => member(meId);
const isAdmin = () => { const m = me(); return !!m && m.role === "admin"; };
const admins = () => state.members.filter((m) => m.role === "admin");
function sortedMembers(){
  return state.members.slice().sort((a, b) =>
    (a.role === b.role ? 0 : a.role === "admin" ? 1 : -1) || String(a.created_at).localeCompare(String(b.created_at)));
}

function isActiveOn(t, d){
  if (t.archived) return false;
  if (t.freq === "weekdays") { const w = d.getDay(); return w >= 1 && w <= 5; }
  return true;
}
function periodOf(t, d){
  d = d || today0();
  if (t.freq === "daily" || t.freq === "weekdays") return toISO(d);
  if (t.freq === "weekly") return toISO(mondayOf(d));
  return "once";
}
/* --- tareas de «todos» ---
   t.team = "id1,id2,…": CADA uno tiene que hacerla (su cama, sus dientes).
   Hay una fila hecha por persona: id = tarea|periodo|persona. */
function teamOf(t){ return t.team ? String(t.team).split(",").map((x) => x.trim()).filter((id) => member(id)) : []; }
const isTeam = (t) => teamOf(t).length > 0;
let ctxMember = "";     // persona desde cuya vista se está pintando (Hoy de X, filtro de la lista…)
const doneId = (t, period, mid) => t.id + "|" + period + (isTeam(t) ? "|" + mid : "");
/* En una tarea de «todos», de quién hablamos: la persona de la vista si está en el equipo,
   si no yo si estoy, si no nadie (vista de conjunto). */
function subjectOf(t, mid){
  const tm = teamOf(t);
  if (mid && tm.includes(mid)) return mid;
  if (!mid && ctxMember && tm.includes(ctxMember)) return ctxMember;
  if (!mid && tm.includes(meId)) return meId;
  return null;
}
function teamProgress(t, d){
  const p = periodOf(t, d), tm = teamOf(t);
  const rows = tm.map((id) => state.done.find((x) => x.id === doneId(t, p, id)) || null);
  return { tm, rows, ok: rows.filter((r) => r && r.status === "ok").length, done: rows.filter((r) => r && r.status !== "no").length };
}
function doneFor(t, d, mid){
  if (isTeam(t)) {
    const who = subjectOf(t, mid);
    return who ? state.done.find((x) => x.id === doneId(t, periodOf(t, d), who)) || null : null;
  }
  return state.done.find((x) => x.id === doneId(t, periodOf(t, d))) || null;
}
function statusOf(t, mid){
  if (isTeam(t) && !subjectOf(t, mid)) {         // vista de conjunto: hecha cuando la han hecho todos
    const tp = teamProgress(t);
    return tp.ok === tp.tm.length ? "ok" : tp.done === tp.tm.length ? "pending" : "todo";
  }
  const d = doneFor(t, undefined, mid); return d ? d.status : "todo";
}
const isExam = (t) => t.kind === "estudio" && t.study_type === "examen";
/* --- turnos rotativos ---
   t.rotation = "id1,id2,id3" (en orden) y t.rot_start = día en que le toca al primero.
   Diarias: cambia cada día. Entre semana: cada día laborable. Semanales: cada lunes. */
function rotationOf(t){
  if (!t.rotation || !t.freq || t.freq === "none") return [];
  return String(t.rotation).split(",").map((x) => x.trim()).filter((id) => member(id));
}
const EPOCH_MON = new Date(1970, 0, 5);          // un lunes
const dayNum = (d) => Math.round((d - EPOCH_MON) / 86400000);
function weekdaysBefore(d){ const n = dayNum(d); const w = Math.floor(n / 7); return w * 5 + Math.min(n - w * 7, 5); }
function rotStep(t, d){
  const start = parseDate(t.rot_start) || parseDate(String(t.created_at || "").slice(0,10)) || today0();
  if (t.freq === "weekly") return Math.round((mondayOf(d) - mondayOf(start)) / (7 * 86400000));
  if (t.freq === "weekdays") return weekdaysBefore(d) - weekdaysBefore(start);
  return dayNum(d) - dayNum(start);
}
/* A quién le toca la tarea ese día (null = cualquiera). */
function assigneeOn(t, d){
  const rot = rotationOf(t);
  if (rot.length) { const n = rot.length; return rot[((rotStep(t, d || today0()) % n) + n) % n]; }
  return t.assignee || null;
}
/* Próximos turnos: [{d, id}] a partir de hoy, saltando los días en que no toca. */
function nextTurns(t, count){
  const out = [], d = today0();
  for (let i = 0; out.length < count && i < 60; i++) {
    if (isActiveOn(t, d) && (t.freq !== "weekly" || i === 0 || d.getDay() === 1)) out.push({ d:new Date(d), id:assigneeOn(t, d) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
/* En «Hoy» cuenta a quién le toca hoy; en las listas, cualquiera que esté en el turno. */
function forMember(t, id, anyTurn){
  if (id === "all") return true;
  if (isTeam(t)) return teamOf(t).includes(id);
  if (anyTurn && rotationOf(t).includes(id)) return true;
  const a = assigneeOn(t);
  return !a || a === id;
}

/* Un miembro puede marcar sus tareas (o su turno de hoy) y las de «cualquiera». Un admin, todas. */
function canMark(t){
  const m = me(); if (!m) return false;
  if (m.role === "admin") return true;
  if (isTeam(t)) return teamOf(t).includes(m.id);
  const a = assigneeOn(t); return !a || a === m.id;
}
/* Un miembro solo puede editar lo que él mismo creó y aún no está aprobado. */
function canEdit(t){
  if (isAdmin()) return true;
  return t.created_by === meId && !state.done.some((d) => d.task_id === t.id && d.status === "ok");
}

function balance(id){ return state.points.reduce((s, p) => s + (p.member_id === id ? Number(p.delta) || 0 : 0), 0); }
function reserved(id){ return state.claims.reduce((s, c) => s + (c.member_id === id && c.status === "pending" ? Number(c.cost) || 0 : 0), 0); }
const available = (id) => balance(id) - reserved(id);
function weekStats(id){
  const from = mondayOf(today0()).getTime();
  let n = 0, pts = 0;
  state.done.forEach((d) => {
    if (d.member_id === id && d.status === "ok" && new Date(d.created_at).getTime() >= from) { n++; pts += Number(d.points) || 0; }
  });
  return { n, pts };
}

/* --- acciones --- */
function tick(t, creditTo){
  const m = me();
  if (!m) { openWho(); return; }
  if (!canMark(t)) { explainLocked(t); return; }
  const period = periodOf(t);
  let who;
  if (isTeam(t)) {
    // cada uno marca la suya; un admin marca la de la persona que está mirando
    who = creditTo || (isAdmin() ? subjectOf(t) : (teamOf(t).includes(m.id) ? m.id : null));
    if (!who) { openTask(t); return; }          // vista de conjunto: elegir a quién
  } else {
    who = creditTo || (isAdmin() && assigneeOn(t) ? assigneeOn(t) : m.id);
  }
  const id = doneId(t, period, who);
  const ex = state.done.find((x) => x.id === id);

  if (ex && ex.status !== "no" && !creditTo) {
    if (ex.status === "pending" && (ex.member_id === meId || isAdmin())) { drop("done", id); toast("Desmarcada"); return; }
    if (ex.status === "ok" && isAdmin()) { drop("points", "d|" + id, true); drop("done", id); toast("Desmarcada y puntos devueltos"); return; }
    toast(ex.status === "ok" ? "Ya está aprobada ✔" : "Esperando revisión");
    return;
  }
  const auto = isAdmin() || !t.needs_ok;
  const pts = Number(t.points) || 0;
  const row = { id, task_id:t.id, member_id:who, period, status: auto ? "ok" : "pending",
    points:pts, reviewed_by: auto ? meId : null, created_at:nowISO() };
  put("done", row, true);
  if (auto && pts) put("points", { id:"d|" + id, member_id:who, delta:pts, reason:t.title, given_by:meId }, true);
  else drop("points", "d|" + id, true);
  render();
  if (auto) celebrate(pts ? "+" + pts + " ⭐" : "¡Hecho!");
  else toast("¡Bien! Ahora la revisa un adulto");
}

function review(d, ok){
  const t = state.tasks.find((x) => x.id === d.task_id);
  put("done", Object.assign({}, d, { status: ok ? "ok" : "no", reviewed_by:meId }), true);
  if (ok && Number(d.points)) put("points", { id:"d|" + d.id, member_id:d.member_id, delta:Number(d.points),
    reason: t ? t.title : "Tarea", given_by:meId }, true);
  else drop("points", "d|" + d.id, true);
  render();
  toast(ok ? "Aprobada" + (Number(d.points) ? " · +" + d.points + " ⭐" : "") : "Rechazada: tendrá que repetirla");
}

function decideClaim(c, ok){
  put("claims", Object.assign({}, c, { status: ok ? "ok" : "no", reviewed_by:meId }), true);
  if (ok) put("points", { id:"c|" + c.id, member_id:c.member_id, delta:-Math.abs(Number(c.cost) || 0),
    reason:"Premio: " + c.title, given_by:meId }, true);
  render();
  toast(ok ? "Premio concedido 🎁" : "Premio denegado");
}

function giveReward(r, memberId){
  const c = put("claims", { id:uid(), reward_id:r.id, member_id:memberId, title:r.title, cost:Number(r.cost) || 0,
    status:"ok", reviewed_by:meId }, true);
  put("points", { id:"c|" + c.id, member_id:memberId, delta:-Math.abs(c.cost), reason:"Premio: " + r.title, given_by:meId }, true);
  render();
}

/* --- PIN --- */
async function hashPin(pin){
  const txt = HOME + ":" + pin;
  if (window.crypto && crypto.subtle && window.TextEncoder) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return "s:" + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "f:" + (h >>> 0).toString(16);
}

/* ---------------------------------------------------------------
   6. Pintado
   --------------------------------------------------------------- */
const view = document.getElementById("view");

function av(m, cls){
  if (!m) return '<span class="av any ' + (cls || "") + '" title="Cualquiera">👥</span>';
  const ph = "photo" in m ? m.photo : (photos[m.id] && photos[m.id].photo);
  const inner = ph && /^data:image\/(jpeg|png|webp);base64,/.test(ph) ? '<img src="' + ph + '" alt="">' : esc(m.emoji || "🙂");
  return '<span class="av ' + (ph ? "photo " : "") + (cls || "") + '" style="--c:' + esc(m.color || COLORS[0]) + '" title="' + esc(m.name) + '">' + inner + "</span>";
}
function secHTML(title, count, cls, extra){
  return '<div class="sec ' + (cls || "") + '"><h2>' + title + '</h2><span class="rule"></span>' +
    (extra || (count === "" ? "" : '<span class="count mono">' + count + "</span>")) + "</div>";
}
function emptyHTML(glyph, title, text, small){
  return '<div class="empty' + (small ? " small" : "") + '"><div class="glyph">' + glyph + "</div><h3>" + esc(title) + "</h3><p>" + text + "</p></div>";
}
function paint(html){ if (html === lastPainted) return; lastPainted = html; view.innerHTML = html; }

function peopleHTML(cur, withAll){
  const ms = sortedMembers();
  if (ms.length < 2 && !withAll) return "";
  return '<div class="people" role="group" aria-label="Filtrar por persona">' +
    (withAll ? '<button class="person all" type="button" data-act="filter" data-id="all" aria-pressed="' + (cur === "all") + '">Todos</button>' : "") +
    ms.map((m) => '<button class="person" type="button" data-act="filter" data-id="' + esc(m.id) + '" aria-pressed="' + (cur === m.id) + '">' +
      av(m, "sm") + esc(m.name) + "</button>").join("") + "</div>";
}

function taskHTML(t, opts){
  opts = opts || {};
  const d = doneFor(t);
  const team = isTeam(t), subj = team ? subjectOf(t) : null;
  const st = team && !subj ? statusOf(t) : (d ? d.status : "todo");
  const exam = isExam(t);
  const pills = [];
  if (team) {
    const tp = teamProgress(t);
    pills.push('<span class="pill team">👨‍👩‍👧 Todos' + (subj ? "" : " · " + tp.ok + "/" + tp.tm.length) + "</span>");
  }
  if (t.kind === "estudio") pills.push('<span class="pill est">' + esc([STUDY[t.study_type] || "Estudio", t.subject].filter(Boolean).join(" · ")) + "</span>");
  if (t.freq && t.freq !== "none") pills.push('<span class="pill">' + FREQ[t.freq] + "</span>");
  if (rotationOf(t).length) pills.push('<span class="pill turn">🔁 Turnos</span>');
  if (t.due && st !== "ok") { const di = dueInfo(t.due, exam); if (di) pills.push('<span class="pill ' + di.cls + '">' + esc(di.label) + "</span>"); }
  if (st === "pending") pills.push('<span class="pill pending">Por revisar</span>');
  if (st === "no") pills.push('<span class="pill no">Rechazada · repítela</span>');
  if (!team && d && st !== "no" && d.member_id && d.member_id !== assigneeOn(t)) {
    const who = member(d.member_id);
    if (who) pills.push('<span class="by">hecha por ' + esc(who.name) + "</span>");
  }
  if (t.grade) pills.push('<span class="pill gold">Nota: ' + esc(t.grade) + "</span>");
  const locked = team && !subj ? !isAdmin()
    : !canMark(t) || (team && !isAdmin() && subj !== meId) || (st === "ok" && !isAdmin()) || (st === "pending" && d && d.member_id !== meId && !isAdmin());
  const tickIcon = st === "ok" ? ICONS.check : st === "pending" ? ICONS.wait : "";
  const tickLabel = st === "ok" ? "Hecha" : st === "pending" ? "Pendiente de revisión" : "Marcar como hecha";
  return '<div class="task" data-kind="' + esc(t.kind) + '" data-st="' + st + '">' +
    '<button class="tick' + (locked ? " locked" : "") + '" type="button" data-act="tick" data-id="' + esc(t.id) + '" aria-label="' + tickLabel + ": " + esc(t.title) + '">' + tickIcon + "</button>" +
    '<button class="task-main" type="button" data-act="task" data-id="' + esc(t.id) + '">' +
      '<span class="task-title">' + esc(t.title) + "</span>" +
      (pills.length ? '<span class="sub">' + pills.join("") + "</span>" : "") +
    "</button>" +
    (Number(t.points) ? '<span class="pts">+' + Number(t.points) + "</span>" : "") +
    (opts.noAvatar ? "" : team ? '<span class="av any sm" title="Todos">👨‍👩‍👧</span>' : av(member(assigneeOn(t)), "sm")) +
    "</div>";
}
const listHTML = (arr, opts) => '<div class="list">' + arr.map((t) => taskHTML(t, opts)).join("") + "</div>";

function byDue(a, b){
  const da = daysUntil(a.due), db = daysUntil(b.due);
  if (da !== null && db === null) return -1;
  if (da === null && db !== null) return 1;
  if (da !== null && db !== null && da !== db) return da - db;
  return a.title.localeCompare(b.title, "es");
}
const byTitle = (a, b) => a.title.localeCompare(b.title, "es");
function doneTime(t){ const d = state.done.find((x) => x.task_id === t.id && x.status === "ok"); return d ? d.updated_at || d.created_at : ""; }

function render(){
  paintTabs();
  const m = me();
  const who = document.getElementById("whoBtn");
  who.innerHTML = m ? av(m, "sm") + '<span class="nm">' + esc(m.name) + "</span>" + (m.role === "admin" ? '<span class="crown">★</span>' : "")
                    : '<span class="nm" style="padding-left:8px">¿Quién eres?</span>';
  if (!loaded) {
    const retry = '<br><br><button class="btn primary" type="button" data-act="retry">Reintentar</button>';
    if (loadError === "tables") paint(emptyHTML("🧩", "Faltan tablas en Supabase", "Revisa el aviso de arriba." + retry));
    else if (loadError === "offline") paint(emptyHTML("📡", "Sin conexión", "La primera vez hace falta internet para cargar la casa. Se reintentará solo." + retry));
    else if (loadError) paint(emptyHTML("⚠️", "No se ha podido conectar", "No hay respuesta de la base de datos. Se reintentará solo cada pocos segundos." +
      (bannerDetail ? '<br><span class="by mono">' + esc(bannerDetail) + " · " + esc(BASE.replace(/^https:\/\//, "")) + "</span>" : "") + retry));
    else paint(emptyHTML("⏳", "Cargando la casa…", "Un segundo."));
    return;
  }
  if (tab === "hoy") renderHoy();
  else if (tab === "casa") renderList("casa");
  else if (tab === "estudios") renderList("estudio");
  else if (tab === "premios") renderPremios();
  else renderFamilia();

  const fab = document.getElementById("fabWrap");
  const lbl = document.getElementById("fabLabel");
  if (tab === "premios") { fab.hidden = !isAdmin(); lbl.textContent = "Nuevo premio"; }
  else if (tab === "familia") { fab.hidden = !isAdmin(); lbl.textContent = "Añadir miembro"; }
  else { fab.hidden = !m; lbl.textContent = tab === "estudios" ? "Nuevo estudio" : "Nueva tarea"; }
}

function todayRemaining(id){
  const d = today0();
  return state.tasks.filter((t) => !isExam(t) && isActiveOn(t, d) && forMember(t, id) &&
    (t.freq !== "none" || !t.due || daysUntil(t.due) <= 0) && ["todo","no"].includes(statusOf(t, id))).length;
}

function paintTabs(){
  const bar = document.getElementById("tabbar");
  let hoyBadge = 0;
  if (isAdmin()) hoyBadge = state.done.filter((d) => d.status === "pending").length + state.claims.filter((c) => c.status === "pending").length;
  else if (me()) hoyBadge = todayRemaining(meId);
  const sig = tab + "|" + hoyBadge;
  if (bar.dataset.sig === sig) return;
  bar.dataset.sig = sig;
  bar.innerHTML = TABS.map((t) => {
    const cur = tab === t.id ? ' aria-current="page"' : "";
    const badge = (t.id === "hoy" && hoyBadge) ? '<span class="badge">' + hoyBadge + "</span>" : "";
    return '<button class="tab" type="button" data-t="' + t.id + '"' + cur + ">" + badge + ICONS[t.id] + "<span>" + t.label + "</span></button>";
  }).join("");
}
document.getElementById("tabbar").addEventListener("click", (e) => {
  const b = e.target.closest(".tab"); if (!b) return;
  tab = b.dataset.t; window.scrollTo(0, 0);
  try { sessionStorage.setItem("funnyhouse.tab", tab); } catch(err){}
  render();
});

/* ---- Hoy ---- */
function reviewHTML(d){
  const t = state.tasks.find((x) => x.id === d.task_id);
  const m = member(d.member_id);
  return '<div class="review">' + av(m) +
    '<div class="txt"><div class="t1">' + esc(t ? t.title : "Tarea borrada") + '</div><div class="t2">' + esc(m ? m.name : "?") + " · " +
      esc(whenLabel(d.created_at)) + (Number(d.points) ? ' · <span class="pts">+' + d.points + "</span>" : "") + "</div></div>" +
    '<button class="no-btn" type="button" data-act="reject" data-id="' + esc(d.id) + '" aria-label="Rechazar">' + ICONS.x + "</button>" +
    '<button class="yes" type="button" data-act="approve" data-id="' + esc(d.id) + '" aria-label="Aprobar">' + ICONS.check + "</button></div>";
}
function claimHTML(c, adminView){
  const m = member(c.member_id);
  return '<div class="review">' + av(m) +
    '<div class="txt"><div class="t1">' + esc(c.title) + '</div><div class="t2">' + esc(m ? m.name : "?") + ' · <span class="pts">' + c.cost + " ⭐</span></div></div>" +
    (adminView
      ? '<button class="no-btn" type="button" data-act="claim-no" data-id="' + esc(c.id) + '" aria-label="Denegar">' + ICONS.x + "</button>" +
        '<button class="yes" type="button" data-act="claim-ok" data-id="' + esc(c.id) + '" aria-label="Conceder">' + ICONS.check + "</button>"
      : '<button class="mini" type="button" data-act="claim-cancel" data-id="' + esc(c.id) + '">Cancelar</button>') + "</div>";
}

function renderHoy(){
  const m = me();
  if (!m) {
    paint('<img class="welcome" src="img/bienvenida.webp" alt="Una familia feliz delante de una casa sonriente" width="520" height="520">' +
      emptyHTML("👋", state.members.length ? "¿Quién eres?" : "Bienvenidos a FunnyHouse",
      state.members.length ? 'Elige tu perfil para ver tus tareas.<br><br><button class="btn primary" type="button" data-act="who">Elegir perfil</button>'
                           : 'Primero crea tu perfil de adulto: podrás añadir al resto de la familia después.<br><br><button class="btn primary" type="button" data-act="who">Empezar</button>'));
    return;
  }
  const fid = member(filters.hoy) ? filters.hoy : meId;
  const fm = member(fid);
  const d = today0();
  ctxMember = fid;
  const mine = state.tasks.filter((t) => !t.archived && forMember(t, fid));

  const overdue = [], today = [], doneToday = [], upcoming = [], exams = [];
  mine.forEach((t) => {
    const st = statusOf(t);
    // una tarea de «cualquiera» que ya hizo otra persona deja de ser de este día
    const dn0 = doneFor(t);
    if (!isTeam(t) && !assigneeOn(t) && dn0 && dn0.status !== "no" && dn0.member_id !== fid) return;
    if (isExam(t)) {
      const n = daysUntil(t.due);
      if (st !== "ok" && n !== null && n >= 0 && n <= 14) exams.push(t);
      return;
    }
    if (t.freq !== "none") {
      if (!isActiveOn(t, d)) return;
      (st === "ok" || st === "pending" ? doneToday : today).push(t);
      return;
    }
    const n = daysUntil(t.due);
    if (st === "ok" || st === "pending") {
      const dn = doneFor(t);
      if (dn && whenLabel(dn.created_at) === "Hoy") doneToday.push(t);
      return;
    }
    if (n !== null && n < 0) overdue.push(t);
    else if (n === null || n === 0) today.push(t);
    else if (n <= 7) upcoming.push(t);
  });

  const total = overdue.length + today.length + doneToday.length;
  const pct = total ? Math.round(doneToday.length / total * 100) : 0;
  const self = fid === meId;
  let html = '<div class="hero">' + av(fm, "lg") +
    '<div class="hero-main"><h1>' + (self ? "Hola, " + esc(fm.name) : "Día de " + esc(fm.name)) + "</h1>" +
    '<div class="sub">' + (total ? doneToday.length + " de " + total + " tareas hechas hoy" + (pct === 100 ? " · ¡Todo listo! 🎉" : "")
                                 : "Nada pendiente para hoy") + "</div>" +
    (total ? '<div class="bar"><i style="width:' + pct + '%"></i></div>' : "") + "</div>" +
    '<div class="stars"><b>' + balance(fid) + "</b><span>Puntos</span></div></div>";

  if (isAdmin() && self) {
    const pend = state.done.filter((x) => x.status === "pending").sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const claims = state.claims.filter((c) => c.status === "pending");
    if (pend.length) html += secHTML("Por revisar", pend.length, "warn") + '<div class="list">' + pend.map(reviewHTML).join("") + "</div>";
    if (claims.length) html += secHTML("Premios pedidos", claims.length, "gold") + '<div class="list">' + claims.map((c) => claimHTML(c, true)).join("") + "</div>";
  }

  html += '<div style="margin-top:14px">' + peopleHTML(fid, false) + "</div>";

  if (overdue.length) html += secHTML("Atrasadas", overdue.length, "crit") + listHTML(overdue.sort(byDue), { noAvatar: true });
  html += secHTML("Para hoy", today.length);
  html += today.length ? listHTML(today.sort(byTitle), { noAvatar: true })
    : emptyHTML("🌈", total ? "¡Todo hecho por hoy!" : "Día libre", total ? "Buen trabajo. Mañana más." : "No hay tareas para hoy." + (isAdmin() ? " Toca «Nueva tarea» para repartir alguna." : ""), true);
  if (exams.length) html += secHTML("Próximos exámenes", exams.length, "warn") + listHTML(exams.sort(byDue), { noAvatar: true });
  if (upcoming.length) html += secHTML("Próximos días", upcoming.length) + listHTML(upcoming.sort(byDue), { noAvatar: true });
  if (doneToday.length) html += secHTML("Hechas", doneToday.length) + listHTML(doneToday.sort(byTitle), { noAvatar: true });
  paint(html);
}

/* ---- Casa / Estudios ---- */
function renderList(kind){
  const key = kind === "casa" ? "casa" : "estudios";
  const fid = filters[key] === "all" || member(filters[key]) ? filters[key] : "all";
  ctxMember = fid === "all" ? "" : fid;
  const all = state.tasks.filter((t) => t.kind === kind && !t.archived && forMember(t, fid, true));
  let html = peopleHTML(fid, true);

  if (!all.length) {
    html += kind === "casa"
      ? emptyHTML("🏠", "Aún no hay tareas de casa", "Hacer la cama, poner la mesa, sacar la basura… Toca «Nueva tarea» para empezar.")
      : emptyHTML("📚", "Nada de estudios todavía", "Apunta aquí deberes, exámenes y trabajos. Cada uno puede apuntar los suyos.");
    paint(html); return;
  }

  const recurring = all.filter((t) => t.freq !== "none");
  const once = all.filter((t) => t.freq === "none");
  const pendingOnce = once.filter((t) => statusOf(t) !== "ok");
  const finished = once.filter((t) => statusOf(t) === "ok").sort((a, b) => String(doneTime(b)).localeCompare(String(doneTime(a)))).slice(0, 10);

  if (kind === "casa") {
    const daily = recurring.filter((t) => t.freq === "daily" || t.freq === "weekdays").sort(byTitle);
    const weekly = recurring.filter((t) => t.freq === "weekly").sort(byTitle);
    if (pendingOnce.length) html += secHTML("Pendientes", pendingOnce.length) + listHTML(pendingOnce.sort(byDue));
    if (daily.length) html += secHTML("Cada día", daily.length) + listHTML(daily);
    if (weekly.length) html += secHTML("Cada semana", weekly.length) + listHTML(weekly);
  } else {
    const exams = pendingOnce.filter(isExam).sort(byDue);
    const work = pendingOnce.filter((t) => !isExam(t)).sort(byDue);
    if (exams.length) html += secHTML("Exámenes", exams.length, exams.some((t) => (daysUntil(t.due) ?? 99) <= 3) ? "warn" : "") + listHTML(exams);
    if (work.length) html += secHTML("Deberes y trabajos", work.length) + listHTML(work);
    if (recurring.length) html += secHTML("Rutina de estudio", recurring.length) + listHTML(recurring.sort(byTitle));
  }
  if (finished.length) html += secHTML("Terminadas", finished.length) + listHTML(finished);
  paint(html);
}

/* ---- Premios ---- */
function renderPremios(){
  const m = me();
  const ms = sortedMembers().slice().sort((a, b) => balance(b.id) - balance(a.id));
  const medals = ["🥇","🥈","🥉"];
  let html = "";
  if (ms.length) {
    html += secHTML("Marcador", "", "gold") + '<div class="board">' + ms.map((x, i) =>
      '<button class="score" type="button" data-act="filter" data-id="' + esc(x.id) + '">' +
        (balance(x.id) > 0 && i < 3 ? '<span class="medal">' + medals[i] + "</span>" : "") +
        av(x, "lg") + '<span class="nm">' + esc(x.name) + "</span><b>" + balance(x.id) + " ⭐</b>" +
        '<span class="wk">' + (weekStats(x.id).pts ? "+" + weekStats(x.id).pts + " esta semana" : "Esta semana: 0") + "</span></button>").join("") + "</div>";
  }
  const pendAll = state.claims.filter((c) => c.status === "pending");
  if (isAdmin() && pendAll.length) html += secHTML("Premios pedidos", pendAll.length, "gold") + '<div class="list">' + pendAll.map((c) => claimHTML(c, true)).join("") + "</div>";
  else if (m) {
    const mineP = pendAll.filter((c) => c.member_id === meId);
    if (mineP.length) html += secHTML("Esperando a un adulto", mineP.length, "warn") + '<div class="list">' + mineP.map((c) => claimHTML(c, false)).join("") + "</div>";
  }

  const rewards = state.rewards.slice().sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  html += secHTML("Premios", rewards.length || "");
  if (!rewards.length) {
    html += emptyHTML("🎁", "Aún no hay premios", isAdmin() ? "Toca «Nuevo premio» para crear el catálogo: pantalla extra, elegir la cena, una peli…" : "Pide a un adulto que cree algunos premios.", true);
  } else {
    const av_ = m ? available(meId) : 0;
    html += '<div class="shop">' + rewards.map((r) => {
      const cost = Number(r.cost) || 0;
      const pct = cost ? Math.min(100, Math.round(Math.max(0, av_) / cost * 100)) : 100;
      const ready = m && av_ >= cost;
      return '<button class="reward" type="button" data-act="reward" data-id="' + esc(r.id) + '">' +
        '<span class="em">' + esc(r.emoji || "🎁") + '</span><span class="rt">' + esc(r.title) + '</span><span class="cost">' + cost + " ⭐</span>" +
        (m && !isAdmin() ? '<span class="bar"><i style="width:' + pct + '%"></i></span><span class="need' + (ready ? " ready" : "") + '">' +
          (ready ? "¡Puedes pedirlo!" : "Te faltan " + (cost - av_)) + "</span>" : "") + "</button>";
    }).join("") + "</div>";
  }

  const fid = member(filters.premios) ? filters.premios : meId;
  if (member(fid)) {
    const rows = state.points.filter((p) => p.member_id === fid)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 25);
    html += secHTML("Movimientos de " + esc(member(fid).name), "");
    html += rows.length ? '<div class="ledger">' + rows.map((p) => {
      const v = Number(p.delta) || 0;
      return '<div class="lrow"><span class="r">' + esc(p.reason || "Puntos") + '<div class="d">' + esc(whenLabel(p.created_at)) +
        (member(p.given_by) && p.given_by !== p.member_id ? " · " + esc(member(p.given_by).name) : "") + "</div></span>" +
        '<span class="v ' + (v >= 0 ? "plus" : "minus") + '">' + (v >= 0 ? "+" : "−") + Math.abs(v) + "</span></div>";
    }).join("") + "</div>" : emptyHTML("⭐", "Sin movimientos", "Los puntos aparecen aquí al completar tareas.", true);
  }
  paint(html);
}

/* ---- Familia ---- */
function renderFamilia(){
  const ms = sortedMembers();
  let html = secHTML("La familia", ms.length);
  html += ms.length ? '<div class="list">' + ms.map((x) => {
    const w = weekStats(x.id);
    return '<button class="mcard" type="button" data-act="member" data-id="' + esc(x.id) + '">' + av(x, "lg") +
      '<span class="info"><span class="nm">' + esc(x.name) + (x.id === meId ? ' <span class="by">(tú)</span>' : "") + "</span>" +
      '<span class="sub"><span class="role ' + (x.role === "admin" ? "" : "member") + '">' + (x.role === "admin" ? "Admin" : "Miembro") + "</span>" +
      '<span class="by">' + w.n + " tarea" + (w.n === 1 ? "" : "s") + " esta semana</span></span></span>" +
      '<span class="pts">' + balance(x.id) + " ⭐</span>" + '<span class="chev">' + ICONS.chev + "</span></button>";
  }).join("") + "</div>" : emptyHTML("👨‍👩‍👧‍👦", "Aún no hay nadie", 'Crea el primer perfil.<br><br><button class="btn primary" type="button" data-act="who">Empezar</button>', true);

  if (isAdmin()) html += '<p class="by" style="margin:10px 2px 0">Los <b>admin</b> aprueban tareas, reparten puntos, crean premios y gestionan la familia. Los <b>miembros</b> marcan sus tareas, apuntan sus deberes y piden premios.</p>';

  html += secHTML("Este dispositivo", "versión " + APP_VERSION);
  html += '<div class="list"><button class="linkrow" type="button" data-act="who">' + av(me(), "sm") +
    '<span class="grow">' + (me() ? "Estás como " + esc(me().name) + " · Cambiar" : "Elegir quién eres") + '</span><span class="chev">' + ICONS.chev + "</span></button>";
  if (DESPENSAR) html += '<a class="linkrow" href="' + esc(DESPENSAR) + '"><span class="av sm" style="--c:#2E6FCB">🥫</span><span class="grow">Abrir Despensar</span><span class="chev">' + ICONS.chev + "</span></a>";
  html += "</div>";
  paint(html);
}

/* --- clics en la vista (un único manejador) --- */
view.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || !view.contains(b)) return;
  const id = b.dataset.id;
  const task = () => state.tasks.find((t) => t.id === id);
  switch (b.dataset.act) {
    case "tick": { const t = task(); if (t) { burstAt(b); if (b.classList.contains("locked") && !isAdmin()) explainLocked(t); else tick(t); } break; }
    case "task": { const t = task(); if (t) openTask(t); break; }
    case "approve": case "reject": {
      const d = state.done.find((x) => x.id === id);
      if (d && isAdmin()) review(d, b.dataset.act === "approve");
      break;
    }
    case "claim-ok": case "claim-no": {
      const c = state.claims.find((x) => x.id === id);
      if (c && isAdmin()) decideClaim(c, b.dataset.act === "claim-ok");
      break;
    }
    case "claim-cancel": {
      const c = state.claims.find((x) => x.id === id);
      if (c && (c.member_id === meId || isAdmin()) && c.status === "pending") { drop("claims", id); toast("Petición cancelada"); }
      break;
    }
    case "filter": {
      const key = tab === "estudios" ? "estudios" : tab;
      filters[key] = id;
      render();
      break;
    }
    case "reward": { const r = state.rewards.find((x) => x.id === id); if (r) openReward(r); break; }
    case "member": { const m = member(id); if (m) openMember(m); break; }
    case "who": openWho(); break;
    case "retry": retryNow(); break;
  }
});

function explainLocked(t){
  if (isTeam(t) && !teamOf(t).includes(meId)) { toast("Esta la tiene que hacer cada uno: no estás en la lista"); return; }
  if (isTeam(t) && subjectOf(t) !== meId) { toast("Cada uno marca la suya"); return; }
  const st = statusOf(t);
  if (st === "ok") toast("Ya está aprobada ✔");
  else if (st === "pending") toast("Esperando revisión");
  else { const a = member(assigneeOn(t)); toast(a ? (rotationOf(t).length ? "Hoy le toca a " : "Esta tarea es de ") + a.name : "Esta tarea es de otra persona"); }
}

/* --- aviso y confeti --- */
const toastEl = document.getElementById("toast");
let toastTimer = null;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}
let lastTickRect = null;
function burstAt(el){ lastTickRect = el.getBoundingClientRect(); }
function celebrate(msg){
  toast(msg);
  const r = lastTickRect || { left: innerWidth / 2, top: innerHeight / 2, width:0, height:0 };
  lastTickRect = null;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  ["⭐","✨","🎉","⭐","✨","🌟"].forEach((em, i) => {
    const s = document.createElement("span");
    s.className = "burst"; s.textContent = em;
    const ang = (Math.PI * 2 / 6) * i - Math.PI / 2;
    s.style.left = (x - 10) + "px"; s.style.top = (y - 12) + "px";
    s.style.setProperty("--dx", Math.round(Math.cos(ang) * 60) + "px");
    s.style.setProperty("--dy", Math.round(Math.sin(ang) * 60 - 20) + "px");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  });
}

/* ---------------------------------------------------------------
   7. Hojas
   --------------------------------------------------------------- */
const sheet = document.getElementById("sheet");
const sheetInner = document.getElementById("sheetInner");
const $ = (sel) => sheetInner.querySelector(sel);
const $$ = (sel) => Array.from(sheetInner.querySelectorAll(sel));
let sheetLocked = false;
function openSheet(html, locked){
  sheetLocked = !!locked;
  sheetInner.innerHTML = '<div class="grabber"></div>' + html;
  if (!sheet.open) sheet.showModal();
  sheetInner.scrollTop = 0;
}
function closeSheet(){ sheetLocked = false; if (sheet.open) sheet.close(); }
sheet.addEventListener("click", (e) => { if (e.target === sheet && !sheetLocked) closeSheet(); });
sheet.addEventListener("cancel", (e) => { if (sheetLocked) e.preventDefault(); });
// el evento «close» llega con retraso: si ya se abrió otra hoja, no hay que vaciarla
sheet.addEventListener("close", () => { if (!sheet.open) sheetInner.innerHTML = ""; });

/* Selector de una opción entre botones con aria-pressed. */
function pick(sel, attr, onChange){
  $$(sel).forEach((b) => b.addEventListener("click", () => {
    $$(sel).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    onChange(b.dataset[attr]);
  }));
}
function stepper(minusSel, plusSel, inputSel, step, allowNeg){
  const inp = $(inputSel);
  $(minusSel).addEventListener("click", () => { const v = (Number(inp.value) || 0) - step; inp.value = allowNeg ? v : Math.max(0, v); });
  $(plusSel).addEventListener("click", () => { inp.value = (Number(inp.value) || 0) + step; });
  return inp;
}
function memberChips(id, cur, includeAny, includeAll){
  return '<div class="chips" id="' + id + '">' +
    (includeAny ? '<button class="chip" type="button" data-m="" aria-pressed="' + (!cur) + '">👥 Cualquiera</button>' : "") +
    (includeAll ? '<button class="chip" type="button" data-m="__all" aria-pressed="' + (cur === "__all") + '">👨‍👩‍👧 Todos</button>' : "") +
    sortedMembers().map((m) => '<button class="chip pchip" type="button" data-m="' + esc(m.id) + '" aria-pressed="' + (cur === m.id) + '">' +
      av(m, "sm") + esc(m.name) + "</button>").join("") + "</div>";
}

/* ---- detalle de tarea ---- */
function openTask(t){
  const team = isTeam(t);
  const subj = team ? (teamOf(t).includes(meId) ? meId : null) : null;   // en el detalle, «la mía»
  const d = team ? (subj ? doneFor(t, undefined, subj) : null) : doneFor(t);
  const st = team && !subj ? statusOf(t, "__nadie__") : (d ? d.status : "todo");
  const asg = member(assigneeOn(t));
  const rot = rotationOf(t);
  const exam = isExam(t);
  const pills = [];
  pills.push(t.kind === "estudio" ? '<span class="pill est">' + esc([STUDY[t.study_type] || "Estudio", t.subject].filter(Boolean).join(" · ")) + "</span>"
                                  : '<span class="pill casa">Casa</span>');
  pills.push('<span class="pill">' + FREQ[t.freq || "none"] + "</span>");
  if (t.due) { const di = dueInfo(t.due, exam); pills.push('<span class="pill ' + (st === "ok" ? "" : di.cls) + '">' + esc(di.label) + " · " + shortDate(t.due) + "</span>"); }
  if (Number(t.points)) pills.push('<span class="pill gold">+' + Number(t.points) + " ⭐</span>");
  if (!t.needs_ok) pills.push('<span class="pill">Sin revisión</span>');

  const period = t.freq === "daily" || t.freq === "weekdays" ? "hoy" : t.freq === "weekly" ? "esta semana" : "";
  let stTxt = "";
  if (st === "ok") stTxt = '<span class="pill ok">Hecha' + (period ? " " + period : "") + "</span> " + (member(d.member_id) ? '<span class="by">por ' + esc(member(d.member_id).name) + "</span>" : "");
  else if (st === "pending") stTxt = '<span class="pill pending">Esperando revisión</span> ' + (member(d.member_id) ? '<span class="by">la marcó ' + esc(member(d.member_id).name) + "</span>" : "");
  else if (st === "no") stTxt = '<span class="pill no">Rechazada: hay que repetirla</span>';
  else stTxt = '<span class="pill">Sin hacer' + (period ? " " + period : "") + "</span>";

  const hist = state.done.filter((x) => x.task_id === t.id && x.status === "ok")
    .sort((a, b) => String(b.period).localeCompare(String(a.period))).slice(0, 7);

  let html = "<h2>" + esc(t.title) + "</h2>" +
    '<div class="sub">' + pills.join("") + "</div>" +
    (rot.length
      ? '<div class="field"><span class="lbl">Turnos</span><div class="hist">' + nextTurns(t, 5).map((x, i) =>
          '<div class="h' + (i === 0 ? " now" : "") + '">' + av(member(x.id), "sm") + '<span class="d">' + esc(turnLabel(t, x.d, i)) + "</span><b>" + esc((member(x.id) || {}).name || "") + "</b></div>").join("") + "</div>" +
        '<div class="help">Orden: ' + rot.map((id) => esc(member(id).name)).join(" → ") + ".</div>" +
        (isAdmin() ? '<button class="mini" type="button" id="tSkip" style="margin-top:8px">Pasar el turno al siguiente</button>' : "") + "</div>"
      : team ? teamDetailHTML(t)
      : '<div class="field"><span class="lbl">Para</span><div class="sub" style="margin:0">' + av(asg, "sm") + " " + esc(asg ? asg.name : "Cualquiera") + "</div></div>") +
    (team && !subj ? "" : '<div class="field"><span class="lbl">' + (team ? "La tuya" : "Estado") + '</span><div class="sub" style="margin:0">' + stTxt + "</div></div>") +
    (t.notes ? '<div class="notes">' + esc(t.notes) + "</div>" : "");

  if (exam && (isAdmin() || t.created_by === meId || assigneeOn(t) === meId)) {
    html += '<div class="field"><label for="tGrade">Nota del examen</label><div class="row2"><input id="tGrade" type="text" inputmode="decimal" value="' + esc(t.grade || "") + '" placeholder="Ej. 8,5">' +
      '<button class="btn ghost" type="button" id="tGradeSave">Guardar nota</button></div></div>';
  }
  if (t.freq !== "none" && hist.length) {
    html += '<div class="field"><span class="lbl">Últimas veces</span><div class="hist">' + hist.map((x) =>
      '<div class="h">' + av(member(x.member_id), "sm") + '<span class="d">' + esc(x.period === "once" ? whenLabel(x.created_at) : (t.freq === "weekly" ? "Semana del " + shortDate(x.period) : whenLabel(x.period + "T12:00:00"))) + "</span>" +
      (Number(x.points) ? '<span class="pts">+' + x.points + "</span>" : "") + "</div>").join("") + "</div></div>";
  }

  html += '<div class="btn-stack">';
  if (team && !subj) {
    // admin fuera del equipo: se gestiona desde la lista de cada persona
  } else if (st === "pending" && isAdmin()) {
    html += '<div class="btn-row"><button class="btn danger" type="button" id="tNo">Rechazar</button><button class="btn good" type="button" id="tOk">Aprobar' + (Number(d.points) ? " +" + d.points + " ⭐" : "") + "</button></div>";
  } else if (canMark(t)) {
    if (st === "todo" || st === "no") html += '<button class="btn good" type="button" id="tTick">' + ICONS.check + " Marcar como hecha</button>";
    else if ((st === "pending" && d.member_id === meId) || (st === "ok" && isAdmin())) html += '<button class="btn ghost" type="button" id="tTick">Desmarcar</button>';
  }
  if (!team && isAdmin() && (st === "todo" || st === "no") && state.members.length > 1) {
    html += '<div class="field" style="margin:6px 0 0"><span class="lbl">La ha hecho…</span>' + memberChips("tCredit", "", false) +
      '<div class="help">Márcala como hecha y aprobada a nombre de otra persona.</div></div>';
  }
  if (canEdit(t)) html += '<div class="btn-row"><button class="btn ghost" type="button" id="tEdit">Editar</button><button class="btn danger" type="button" id="tDel">Borrar</button></div>';
  html += "</div>";
  openSheet(html);

  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  on("#tTick", () => { lastTickRect = null; tick(t); closeSheet(); });
  on("#tOk", () => { review(d, true); closeSheet(); });
  on("#tNo", () => { review(d, false); closeSheet(); });
  on("#tEdit", () => openTaskForm({ task:t }));
  on("#tSkip", () => {
    const nt = Object.assign({}, t, { rot_start: toISO(shiftedStart(t)) });
    put("tasks", nt);
    const a = member(assigneeOn(nt));
    toast(a ? "Ahora le toca a " + a.name : "Turno pasado");
    openTask(nt);
  });
  on("#tDel", () => {
    const btn = $("#tDel");
    if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "¿Seguro? Toca otra vez"; return; }
    drop("tasks", t.id, true);
    state.done.filter((x) => x.task_id === t.id && x.status !== "ok").forEach((x) => drop("done", x.id, true));
    render(); closeSheet(); toast("Tarea borrada");
  });
  on("#tGradeSave", () => { put("tasks", Object.assign({}, t, { grade: $("#tGrade").value.trim() || null })); closeSheet(); toast("Nota guardada"); });
  $$("#tCredit .chip").forEach((b) => b.addEventListener("click", () => {
    lastTickRect = null; tick(t, b.dataset.m); closeSheet();
  }));
  // tareas de «todos»: el admin marca o aprueba a cada persona desde su fila
  $$("#tTeam [data-tm]").forEach((b) => b.addEventListener("click", () => {
    const mid = b.dataset.tm, row = state.done.find((x) => x.id === doneId(t, periodOf(t), mid));
    lastTickRect = null;
    if (b.dataset.do === "ok" && row) review(row, true);
    else tick(t, mid);
    openTask(state.tasks.find((x) => x.id === t.id) || t);
  }));
}

function teamDetailHTML(t){
  const tp = teamProgress(t);
  const when = t.freq === "weekly" ? "esta semana" : t.freq === "none" ? "" : "hoy";
  return '<div class="field"><span class="lbl">Cada uno la suya' + (when ? " · " + when : "") + " · " + tp.ok + "/" + tp.tm.length + '</span><div class="hist" id="tTeam">' +
    tp.tm.map((id, i) => {
      const r = tp.rows[i], st = r ? r.status : "todo", m = member(id);
      const pill = st === "ok" ? '<span class="pill ok">Hecha</span>' : st === "pending" ? '<span class="pill pending">Por revisar</span>'
                 : st === "no" ? '<span class="pill no">Rechazada</span>' : '<span class="pill">Sin hacer</span>';
      const btn = !isAdmin() ? "" : st === "pending" ? '<button class="mini" type="button" data-tm="' + esc(id) + '" data-do="ok">Aprobar</button>'
                 : st === "ok" ? "" : '<button class="mini" type="button" data-tm="' + esc(id) + '" data-do="mark">Hecha</button>';
      return '<div class="h">' + av(m, "sm") + '<span class="d">' + esc(m.name) + "</span>" + pill + btn + "</div>";
    }).join("") + "</div></div>";
}

function turnLabel(t, d, i){
  if (t.freq === "weekly") return i === 0 ? "Esta semana" : "Semana del " + shortDate(toISO(d));
  const n = daysUntil(toISO(d));
  if (n === 0) return "Hoy";
  if (n === 1) return "Mañana";
  const w = weekday(toISO(d));
  return w.charAt(0).toUpperCase() + w.slice(1);
}
/* Mover el inicio un turno hacia atrás hace que hoy le toque al siguiente. */
function shiftedStart(t){
  const s0 = parseDate(t.rot_start) || parseDate(String(t.created_at || "").slice(0,10)) || today0();
  const d = new Date(s0);
  if (t.freq === "weekly") d.setDate(d.getDate() - 7);
  else {
    d.setDate(d.getDate() - 1);
    if (t.freq === "weekdays") while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  }
  return d;
}

/* ---- formulario de tarea ---- */
function openTaskForm(opts){
  opts = opts || {};
  const editing = opts.task || null;
  const admin = isAdmin();
  const d = editing ? Object.assign({}, editing) : {
    title:"", kind: opts.kind || "casa", study_type: opts.kind === "estudio" ? "deberes" : null, subject:"",
    assignee: admin ? (tab === "hoy" && member(filters.hoy) && filters.hoy !== meId ? filters.hoy : "") : meId,
    points: admin ? 10 : 0, freq:"none", due:"", needs_ok:true, notes:""
  };
  d.rot = editing ? rotationOf(editing) : [];
  d.isTeam = editing ? isTeam(editing) : false;
  d.teamSel = editing && isTeam(editing) ? teamOf(editing)
    : (state.members.filter((m) => m.role !== "admin").map((m) => m.id));
  if (!d.teamSel.length) d.teamSel = state.members.map((m) => m.id);
  const subjects = [...new Set(SUBJECTS.concat(state.tasks.map((t) => t.subject).filter(Boolean)))];

  const html =
    "<h2>" + (editing ? "Editar" : d.kind === "estudio" ? "Nuevo estudio" : "Nueva tarea") + "</h2>" +
    '<p class="sheet-note">' + (admin ? "Solo el título es obligatorio." : "Puedes apuntar tus propias tareas y deberes. Los puntos los pone un adulto.") + "</p>" +
    '<div class="field"><label for="fTitle">Qué hay que hacer</label><input id="fTitle" type="text" value="' + esc(d.title) + '" placeholder="Hacer la cama" autocomplete="off" maxlength="120"></div>' +
    (editing ? "" : '<div class="field" id="fIdeasWrap"><span class="lbl">Ideas</span><div class="chips" id="fIdeas"></div></div>') +
    '<div class="field"><span class="lbl">Tipo</span><div class="segs" id="fKind">' +
      '<button class="seg" type="button" data-v="casa" aria-pressed="' + (d.kind === "casa") + '">🏠 Casa</button>' +
      '<button class="seg" type="button" data-v="estudio" aria-pressed="' + (d.kind === "estudio") + '">📚 Estudios</button></div></div>' +
    '<div id="fStudy"' + (d.kind === "estudio" ? "" : " hidden") + ">" +
      '<div class="field"><span class="lbl">Qué es</span><div class="chips" id="fStype">' +
        Object.keys(STUDY).map((k) => '<button class="chip" type="button" data-v="' + k + '" aria-pressed="' + (d.study_type === k) + '">' + STUDY[k] + "</button>").join("") + "</div></div>" +
      '<div class="field"><label for="fSubject">Asignatura</label><input id="fSubject" type="text" value="' + esc(d.subject || "") + '" placeholder="Mates" autocomplete="off" maxlength="40">' +
        '<div class="chips" id="fSubj" style="margin-top:7px">' + subjects.map((s) => '<button class="chip" type="button" data-v="' + esc(s) + '">' + esc(s) + "</button>").join("") + "</div></div>" +
    "</div>" +
    '<div class="field"><span class="lbl">Se repite</span><div class="segs s4" id="fFreq">' +
      Object.keys(FREQ).map((k) => '<button class="seg" type="button" data-v="' + k + '" aria-pressed="' + (d.freq === k) + '">' + FREQ[k] + "</button>").join("") + "</div></div>" +
    (admin ? '<div class="field" id="fRotWrap"' + (d.freq === "none" || state.members.length < 2 ? " hidden" : "") + '><span class="lbl">Por turnos</span><div class="chips" id="fRot">' +
      sortedMembers().map((m) => '<button class="chip pchip" type="button" data-m="' + esc(m.id) + '" aria-pressed="false">' + av(m, "sm") + esc(m.name) + '<b class="ord"></b></button>').join("") +
      '</div><div class="help" id="fRotHelp"></div></div>' : "") +
    (admin ? '<div class="field" id="fWhoWrap"><span class="lbl">Para quién</span>' + memberChips("fWho", d.isTeam ? "__all" : (d.assignee || ""), true, state.members.length > 1) +
      '<div class="help" id="fWhoHelp"></div>' +
      '<div id="fTeamWrap" style="margin-top:10px"' + (d.isTeam ? "" : " hidden") + '><span class="lbl">¿Quiénes?</span><div class="chips" id="fTeam">' +
        sortedMembers().map((m) => '<button class="chip pchip" type="button" data-m="' + esc(m.id) + '" aria-pressed="' + d.teamSel.includes(m.id) + '">' + av(m, "sm") + esc(m.name) + "</button>").join("") +
      "</div></div></div>" : "") +
    '<div class="field" id="fDueWrap"' + (d.freq === "none" ? "" : " hidden") + '><label for="fDue" id="fDueLbl">' + (isExam(d) ? "Fecha del examen" : "Para cuándo (opcional)") + "</label>" +
      '<input id="fDue" type="date" value="' + esc(d.due || "") + '"></div>' +
    (admin
      ? '<div class="row2"><div class="field"><label for="fPts">Puntos</label><div class="stepper"><button type="button" id="pMinus" aria-label="Menos">−</button>' +
          '<input id="fPts" type="number" min="0" step="5" value="' + esc(Number(d.points) || 0) + '" inputmode="numeric"><button type="button" id="pPlus" aria-label="Más">+</button></div></div>' +
        '<div class="field"><span class="lbl">Revisión</span><button class="switch" type="button" id="fOk" aria-pressed="' + (d.needs_ok !== false) + '"><span class="k">Un adulto la aprueba</span><span class="tg"></span></button></div></div>'
      : "") +
    '<div class="field"><label for="fNotes">Notas</label><textarea id="fNotes" placeholder="Detalles, temas que entran…" maxlength="600">' + esc(d.notes || "") + "</textarea></div>" +
    '<p class="err" id="fErr"></p>' +
    '<div class="btn-stack"><button class="btn primary" type="button" id="fSave">' + (editing ? "Guardar cambios" : "Crear") + "</button>" +
    '<button class="btn ghost" type="button" id="fCancel">Cancelar</button></div>';
  openSheet(html);

  const paintIdeas = () => {
    const box = $("#fIdeas"); if (!box) return;
    const ideas = d.kind === "estudio" ? IDEAS_EST : IDEAS_CASA;
    box.innerHTML = ideas.map((i) => '<button class="chip ideas" type="button">' + esc(i) + "</button>").join("");
    box.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { $("#fTitle").value = b.textContent; }));
  };
  paintIdeas();
  const syncDueLabel = () => { $("#fDueLbl").textContent = isExam(d) ? "Fecha del examen" : "Para cuándo (opcional)"; };
  pick("#fKind .seg", "v", (v) => {
    d.kind = v; $("#fStudy").hidden = v !== "estudio";
    if (v === "estudio" && !d.study_type) { d.study_type = "deberes"; $$("#fStype .chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === "deberes"))); }
    paintIdeas(); syncDueLabel();
  });
  pick("#fStype .chip", "v", (v) => {
    d.study_type = v;
    if (v === "examen") { d.freq = "none"; $$("#fFreq .seg").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === "none"))); $("#fDueWrap").hidden = false; }
    syncDueLabel();
  });
  $$("#fSubj .chip").forEach((b) => b.addEventListener("click", () => { $("#fSubject").value = b.dataset.v; }));
  const whoHelp = () => {
    const h = $("#fWhoHelp"); if (!h) return;
    h.textContent = d.isTeam ? "Cada persona tiene que hacer la suya, y cada una gana sus puntos."
                  : !d.assignee ? "La hace uno, el primero que pueda." : "";
  };
  pick("#fWho .chip", "m", (v) => {
    d.isTeam = v === "__all"; d.assignee = d.isTeam ? "" : v;
    $("#fTeamWrap").hidden = !d.isTeam; whoHelp(); paintRot();
  });
  $$("#fTeam .chip").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.m, i = d.teamSel.indexOf(id);
    if (i >= 0) d.teamSel.splice(i, 1); else d.teamSel.push(id);
    b.setAttribute("aria-pressed", String(i < 0));
  }));
  if (admin) whoHelp();
  const paintRot = () => {
    if (!$("#fRot")) return;
    const on = d.freq !== "none" && d.rot.length >= 2 && !d.isTeam;
    $$("#fRot .chip").forEach((b) => {
      const i = d.rot.indexOf(b.dataset.m);
      b.setAttribute("aria-pressed", String(i >= 0));
      b.querySelector(".ord").textContent = i >= 0 ? String(i + 1) : "";
    });
    const every = d.freq === "weekly" ? "cada lunes" : d.freq === "weekdays" ? "cada día de lunes a viernes" : "cada día";
    $("#fRotHelp").textContent = on
      ? "Orden: " + d.rot.map((id) => member(id).name).join(" → ") + ". Cambia " + every + "; " +
        (editing && editing.rotation === d.rot.join(",") && editing.freq === d.freq
          ? "hoy le toca a " + member(assigneeOn(editing)).name + "."
          : "empieza " + member(d.rot[0]).name + " hoy.")
      : d.rot.length === 1 ? "Elige al menos otra persona." : "Opcional: toca 2 o más personas en el orden en que les toca.";
    $("#fRotWrap").hidden = d.freq === "none" || state.members.length < 2 || d.isTeam;
    $("#fWhoWrap").hidden = on;
  };
  $$("#fRot .chip").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.m, i = d.rot.indexOf(id);
    if (i >= 0) d.rot.splice(i, 1); else d.rot.push(id);
    paintRot();
  }));
  if (admin) paintRot();
  pick("#fFreq .seg", "v", (v) => { d.freq = v; $("#fDueWrap").hidden = v !== "none"; if (admin) paintRot(); });
  if (admin) {
    stepper("#pMinus", "#pPlus", "#fPts", 5);
    $("#fOk").addEventListener("click", () => { const b = $("#fOk"); b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); });
  }
  $("#fCancel").addEventListener("click", () => editing ? openTask(editing) : closeSheet());
  $("#fSave").addEventListener("click", () => {
    const title = $("#fTitle").value.trim();
    if (!title) { $("#fErr").textContent = "Escribe qué hay que hacer."; $("#fTitle").focus(); return; }
    const due = d.freq === "none" ? ($("#fDue").value || null) : null;
    if (isExam(d) && !due) { $("#fErr").textContent = "Pon la fecha del examen."; return; }
    const keepTeam = admin && d.isTeam;
    if (keepTeam && !d.teamSel.length) { $("#fErr").textContent = "Elige al menos a una persona."; return; }
    const team = keepTeam ? sortedMembers().map((m) => m.id).filter((id) => d.teamSel.includes(id)).join(",")
                          : (admin ? null : (editing ? editing.team || null : null));
    const prevRot = editing ? (editing.rotation || null) : null;
    const rotation = team ? null : admin ? (d.freq !== "none" && d.rot.length >= 2 ? d.rot.join(",") : null) : prevRot;
    const rot_start = !rotation ? null
      : (editing && editing.rot_start && prevRot === rotation && editing.freq === d.freq) ? editing.rot_start : toISO(today0());
    const row = {
      id: editing ? editing.id : uid(),
      rotation, rot_start, team,
      title, kind:d.kind,
      study_type: d.kind === "estudio" ? (d.study_type || "deberes") : null,
      subject: d.kind === "estudio" ? ($("#fSubject").value.trim() || null) : null,
      assignee: rotation || team ? null : admin ? (d.assignee || null) : (editing ? editing.assignee : meId),
      points: admin ? Math.max(0, Math.round(Number($("#fPts").value) || 0)) : (editing ? Number(editing.points) || 0 : 0),
      freq: d.freq || "none",
      due,
      needs_ok: admin ? $("#fOk").getAttribute("aria-pressed") === "true" : true,
      notes: $("#fNotes").value.trim() || null,
      grade: editing ? editing.grade || null : null,
      created_by: editing ? editing.created_by : meId,
      archived: false,
      created_at: editing ? editing.created_at : undefined
    };
    put("tasks", row);
    closeSheet();
    toast(editing ? "Guardado" : "Tarea creada");
  });
  if (!editing) setTimeout(() => { const el = $("#fTitle"); if (el) el.focus(); }, 120);
}

/* ---- premios ---- */
function openReward(r){
  const m = me();
  const cost = Number(r.cost) || 0;
  if (!isAdmin()) {
    const av_ = m ? available(meId) : 0;
    openSheet(
      '<div style="font-size:44px; line-height:1; margin:4px 0 8px">' + esc(r.emoji || "🎁") + "</div>" +
      "<h2>" + esc(r.title) + "</h2>" +
      '<p class="sheet-note">Cuesta <b class="pts">' + cost + " ⭐</b>. Tienes " + av_ + " disponibles" + (reserved(meId) ? " (" + reserved(meId) + " reservados en peticiones)" : "") + ".</p>" +
      '<div class="btn-stack">' + (m && av_ >= cost
        ? '<button class="btn good" type="button" id="rAsk">Pedir este premio</button><p class="by" style="margin:0;text-align:center">Un adulto tiene que aprobarlo.</p>'
        : '<button class="btn ghost" type="button" disabled>Te faltan ' + Math.max(0, cost - av_) + " ⭐</button>") +
      '<button class="btn ghost" type="button" id="rClose">Cerrar</button></div>'
    );
    const ask = $("#rAsk");
    if (ask) ask.addEventListener("click", () => {
      put("claims", { id:uid(), reward_id:r.id, member_id:meId, title:r.title, cost, status:"pending" });
      closeSheet(); celebrate("¡Pedido! 🎁");
    });
    $("#rClose").addEventListener("click", closeSheet);
    return;
  }
  openRewardForm(r);
}

function openRewardForm(r){
  const editing = r || null;
  const d = editing ? Object.assign({}, editing) : { title:"", emoji:"🎁", cost:50 };
  openSheet(
    "<h2>" + (editing ? "Editar premio" : "Nuevo premio") + "</h2>" +
    '<p class="sheet-note">Lo que se puede conseguir con los puntos.</p>' +
    (editing ? "" : '<div class="field"><span class="lbl">Ideas</span><div class="chips" id="rIdeas">' +
      IDEAS_PREMIO.map((p, i) => '<button class="chip ideas" type="button" data-i="' + i + '">' + p[0] + " " + esc(p[1]) + "</button>").join("") + "</div></div>") +
    '<div class="field"><label for="rTitle">Premio</label><input id="rTitle" type="text" value="' + esc(d.title) + '" placeholder="Elegir la cena del sábado" autocomplete="off" maxlength="80"></div>' +
    '<div class="field"><span class="lbl">Icono</span><div class="emojis" id="rEmo">' +
      REWARD_EMOJIS.map((e) => '<button class="emo" type="button" data-v="' + e + '" aria-pressed="' + (d.emoji === e) + '">' + e + "</button>").join("") + "</div></div>" +
    '<div class="field"><label for="rCost">Cuesta (puntos)</label><div class="stepper"><button type="button" id="cMinus" aria-label="Menos">−</button>' +
      '<input id="rCost" type="number" min="0" step="10" value="' + esc(Number(d.cost) || 0) + '" inputmode="numeric"><button type="button" id="cPlus" aria-label="Más">+</button></div></div>' +
    (editing && state.members.length ? '<div class="field"><span class="lbl">Dárselo ya a…</span>' + memberChips("rGive", "", false) +
      '<div class="help">Se descuentan los puntos aunque no le lleguen.</div></div>' : "") +
    '<p class="err" id="rErr"></p>' +
    '<div class="btn-stack"><button class="btn primary" type="button" id="rSave">' + (editing ? "Guardar" : "Crear premio") + "</button>" +
    (editing ? '<button class="btn danger" type="button" id="rDel">Borrar premio</button>' : '<button class="btn ghost" type="button" id="rCancel">Cancelar</button>') + "</div>"
  );
  pick("#rEmo .emo", "v", (v) => { d.emoji = v; });
  stepper("#cMinus", "#cPlus", "#rCost", 10);
  $$("#rIdeas .chip").forEach((b) => b.addEventListener("click", () => {
    const p = IDEAS_PREMIO[Number(b.dataset.i)];
    $("#rTitle").value = p[1]; $("#rCost").value = p[2]; d.emoji = p[0];
    $$("#rEmo .emo").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === p[0])));
  }));
  const cancel = $("#rCancel"); if (cancel) cancel.addEventListener("click", closeSheet);
  $("#rSave").addEventListener("click", () => {
    const title = $("#rTitle").value.trim();
    if (!title) { $("#rErr").textContent = "Ponle nombre al premio."; return; }
    put("rewards", { id: editing ? editing.id : uid(), title, emoji:d.emoji || "🎁", cost:Math.max(0, Math.round(Number($("#rCost").value) || 0)),
      created_at: editing ? editing.created_at : undefined });
    closeSheet(); toast(editing ? "Premio guardado" : "Premio creado");
  });
  const del = $("#rDel");
  if (del) del.addEventListener("click", () => {
    if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "¿Seguro? Toca otra vez"; return; }
    drop("rewards", editing.id); closeSheet(); toast("Premio borrado");
  });
  $$("#rGive .chip").forEach((b) => b.addEventListener("click", () => {
    const m = member(b.dataset.m); if (!m) return;
    giveReward(Object.assign({}, editing, { cost:Math.max(0, Math.round(Number($("#rCost").value) || 0)) }), m.id);
    closeSheet(); celebrate("🎁 Para " + m.name);
  }));
  if (!editing) setTimeout(() => { const el = $("#rTitle"); if (el) el.focus(); }, 120);
}

/* ---- miembros ---- */
function openMember(m){
  const admin = isAdmin();
  const self = m && m.id === meId;
  if (m && !admin && !self) {
    const w = weekStats(m.id);
    openSheet('<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + av(m, "lg") + "<div><h2>" + esc(m.name) + '</h2><span class="role ' + (m.role === "admin" ? "" : "member") + '">' + (m.role === "admin" ? "Admin" : "Miembro") + "</span></div></div>" +
      '<p class="sheet-note">' + balance(m.id) + " ⭐ en total · " + w.n + " tareas esta semana (+" + w.pts + ").</p>" +
      '<div class="btn-stack"><button class="btn ghost" type="button" id="mClose">Cerrar</button></div>');
    $("#mClose").addEventListener("click", closeSheet);
    return;
  }
  openMemberForm(m);
}

function openMemberForm(m, firstRun){
  const admin = isAdmin() || firstRun;
  const editing = m || null;
  const usedColors = state.members.map((x) => x.color);
  const d = editing ? Object.assign({}, editing) : {
    name:"", emoji: AVATARS[state.members.length % AVATARS.length],
    color: COLORS.find((c) => !usedColors.includes(c)) || COLORS[0],
    role: firstRun ? "admin" : "member", has_pin:false
  };
  const lastAdmin = editing && editing.role === "admin" && admins().length <= 1;
  const html =
    (firstRun ? '<img class="welcome sm" src="img/bienvenida.webp" alt="" width="520" height="520">' : "") +
    "<h2>" + (firstRun ? "Crea tu perfil" : editing ? (editing.id === meId ? "Tu perfil" : esc(editing.name)) : "Nuevo miembro") + "</h2>" +
    '<p class="sheet-note">' + (firstRun ? "Serás el primer admin de la casa. Luego podrás añadir al resto de la familia desde «Familia»." : "Cada uno elige su perfil en su móvil.") + "</p>" +
    '<div class="field"><label for="mName">Nombre</label><input id="mName" type="text" value="' + esc(d.name) + '" placeholder="' + (firstRun ? "Papá" : "Lucía") + '" autocomplete="off" maxlength="24"></div>' +
    // la foto solo la ponen o cambian los admin (padres)
    '<div class="field"><span class="lbl">Foto</span><div class="photo-pick"><span id="mPrev"></span>' +
      (admin
        ? '<label class="mini" for="mFile">' + "📷 Hacer o elegir foto</label>" +
          '<input id="mFile" type="file" accept="image/*" hidden>' +
          '<button class="mini" type="button" id="mPhotoDel" hidden>Quitar</button></div>' +
          '<div class="help" id="mPhotoMsg">Opcional. Si no hay foto, se usa el dibujo.</div></div>'
        : "</div>" + '<div class="help">La foto solo la pueden cambiar los admin.</div></div>') +
    '<div class="field"><span class="lbl">Dibujo</span><div class="emojis" id="mEmo">' +
      AVATARS.map((e) => '<button class="emo" type="button" data-v="' + e + '" aria-pressed="' + (d.emoji === e) + '">' + e + "</button>").join("") + "</div></div>" +
    '<div class="field"><span class="lbl">Color</span><div class="colors" id="mCol">' +
      COLORS.map((c) => '<button class="col" type="button" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (d.color === c) + '" aria-label="Color ' + c + '"></button>').join("") + "</div></div>" +
    (admin && !firstRun ? '<div class="field"><span class="lbl">Permisos</span><div class="segs" id="mRole">' +
      '<button class="seg" type="button" data-v="member" aria-pressed="' + (d.role !== "admin") + '"' + (lastAdmin ? " disabled" : "") + ">Miembro</button>" +
      '<button class="seg" type="button" data-v="admin" aria-pressed="' + (d.role === "admin") + '">★ Admin</button></div>' +
      '<div class="help">' + (lastAdmin ? "Es el único admin: no se le pueden quitar los permisos." : "Admin: aprueba tareas, da puntos, crea premios y gestiona la familia.") + "</div></div>" : "") +
    '<div class="field"><label for="mPin">PIN' + (hasPin(d) ? " nuevo" : "") + '</label>' +
      '<input id="mPin" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="' + (hasPin(d) ? "••••  (dejar igual)" : "4 a 8 cifras") + '">' +
      '<div class="help">' + (hasPin(d) ? "Deja el campo vacío para no cambiarlo. Cambiarlo cierra la sesión en sus otros móviles."
                                        : "Cada uno entra con su PIN. Apúntalo: sin él no se puede entrar.") + "</div></div>" +
    (admin && editing && !firstRun
      ? '<div class="field"><span class="lbl">Puntos extra o penalización</span><div class="row2"><div class="stepper"><button type="button" id="bMinus" aria-label="Menos">−</button>' +
          '<input id="bPts" type="number" step="5" value="10" inputmode="numeric"><button type="button" id="bPlus" aria-label="Más">+</button></div>' +
          '<input id="bWhy" type="text" placeholder="Motivo" maxlength="60" style="width:100%;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-size:16px"></div>' +
          '<button class="btn ghost" type="button" id="bGive" style="margin-top:8px">Aplicar puntos</button><div class="help">Usa un número negativo para restar. Saldo actual: ' + balance(editing.id) + " ⭐</div></div>"
      : "") +
    '<p class="err" id="mErr"></p>' +
    '<div class="btn-stack"><button class="btn primary" type="button" id="mSave">' + (firstRun ? "Empezar" : editing ? "Guardar" : "Añadir a la familia") + "</button>" +
    (admin && editing && !firstRun && editing.id !== meId && !lastAdmin ? '<button class="btn danger" type="button" id="mDel">Quitar de la familia</button>' : "") +
    (firstRun ? "" : '<button class="btn ghost" type="button" id="mCancel">Cancelar</button>') + "</div>";
  openSheet(html, firstRun);

  // foto: undefined = sin cambios, null = quitarla, texto = la nueva
  let newPhoto;
  const paintPrev = () => {
    const cur = newPhoto !== undefined ? newPhoto : (editing && photos[editing.id] && photos[editing.id].photo) || null;
    $("#mPrev").innerHTML = av({ id:"", name:$("#mName").value || "?", emoji:d.emoji, color:d.color, photo:cur }, "lg");
    if ($("#mPhotoDel")) $("#mPhotoDel").hidden = !cur;
  };
  paintPrev();
  if (admin) $("#mFile").addEventListener("change", async () => {
    const f = $("#mFile").files && $("#mFile").files[0];
    if (!f) return;
    $("#mPhotoMsg").textContent = "Preparando la foto…";
    try { newPhoto = await resizePhoto(f); $("#mPhotoMsg").textContent = "Se guardará al pulsar «" + $("#mSave").textContent + "»."; }
    catch (e) { $("#mPhotoMsg").textContent = "No se pudo leer esa imagen. Prueba con otra."; }
    $("#mFile").value = "";
    paintPrev();
  });
  if (admin) $("#mPhotoDel").addEventListener("click", () => { newPhoto = null; $("#mPhotoMsg").textContent = "Foto quitada (al guardar)."; paintPrev(); });
  pick("#mEmo .emo", "v", (v) => { d.emoji = v; paintPrev(); });
  pick("#mCol .col", "v", (v) => { d.color = v; paintPrev(); });
  pick("#mRole .seg", "v", (v) => { d.role = v; });
  const cancel = $("#mCancel"); if (cancel) cancel.addEventListener("click", closeSheet);

  if ($("#bGive")) {
    stepper("#bMinus", "#bPlus", "#bPts", 5, true);
    $("#bGive").addEventListener("click", () => {
      const v = Math.round(Number($("#bPts").value) || 0);
      if (!v) return;
      put("points", { id:uid(), member_id:editing.id, delta:v, reason: $("#bWhy").value.trim() || (v > 0 ? "Puntos extra" : "Penalización"), given_by:meId });
      closeSheet(); if (v > 0) celebrate("+" + v + " ⭐ para " + editing.name); else toast(v + " ⭐ a " + editing.name);
    });
  }
  const del = $("#mDel");
  if (del) del.addEventListener("click", () => {
    if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "¿Seguro? Sus puntos se pierden"; return; }
    setPhoto(editing.id, null); drop("members", editing.id); closeSheet(); toast(editing.name + " ya no está en la familia");
  });

  $("#mSave").addEventListener("click", async () => {
    const name = $("#mName").value.trim();
    const pin = $("#mPin").value.trim();
    if (!name) { $("#mErr").textContent = "Escribe un nombre."; $("#mName").focus(); return; }
    if (pin && !/^\d{4,8}$/.test(pin)) { $("#mErr").textContent = "El PIN tiene que ser de 4 a 8 cifras."; return; }
    if (!pin && !hasPin(d)) { $("#mErr").textContent = "Pon un PIN de 4 a 8 cifras: hace falta para entrar."; $("#mPin").focus(); return; }
    if (state.members.some((x) => x.name.toLowerCase() === name.toLowerCase() && (!editing || x.id !== editing.id))) { $("#mErr").textContent = "Ya hay alguien con ese nombre."; return; }
    const row = {
      id: editing ? editing.id : uid(), name, emoji:d.emoji, color:d.color,
      role: admin ? d.role : (editing ? editing.role : "member"),
      created_at: editing ? editing.created_at : undefined
    };
    // Con servidor, el PIN viaja tal cual y Supabase lo cifra; en modo local se cifra aquí.
    if (REMOTE) { if (pin) row.new_pin = pin; }
    else row.pin_hash = pin ? await hashPin(pin) : (d.pin_hash || null);

    if (firstRun && REMOTE) {
      const btn = $("#mSave"); btn.disabled = true; btn.textContent = "Creando…";
      try {
        const r = await rpc("fh_bootstrap", { p_home: HOME, p_member: { id:row.id, name, emoji:d.emoji, color:d.color }, p_pin: pin });
        if (!r || r.error) throw new Error(r ? r.error : "Sin respuesta");
        state.members = [Object.assign({}, row, { home:HOME, role:"admin", has_pin:true })];
        delete state.members[0].new_pin;
        setSession(r.token, r.member);
        if (newPhoto) setPhoto(row.id, newPhoto);
        closeSheet(); toast("¡Bienvenido a FunnyHouse!"); tab = "familia"; render();
      } catch (e) {
        btn.disabled = false; btn.textContent = "Empezar";
        $("#mErr").textContent = e.message && !/^HTTP|Failed|NetworkError|abort/i.test(e.message) ? e.message : "No se ha podido conectar. Inténtalo otra vez.";
      }
      return;
    }
    put("members", row);
    if (admin && newPhoto !== undefined) setPhoto(row.id, newPhoto);
    if (firstRun) { setMe(row.id); closeSheet(); toast("¡Bienvenido a FunnyHouse!"); tab = "familia"; render(); return; }
    closeSheet(); toast(editing ? "Guardado" : name + " ya es de la familia");
  });
  setTimeout(() => { const el = $("#mName"); if (el && !editing) el.focus(); }, 120);
}

/* ---- ¿quién eres? ---- */
function setMe(id){
  meId = id || "";
  try { localStorage.setItem(ME_KEY, meId); } catch(e){}
  filters.hoy = ""; filters.premios = "";
  render();
}

function openWho(){
  if (!state.members.length) {
    if (confirmed) { openMemberForm(null, true); return; }
    openSheet("<h2>Todavía no hemos cargado la familia</h2>" +
      '<p class="sheet-note">Para no crear una casa nueva por error, espera a que la app conecte con la base de datos.</p>' +
      '<div class="btn-stack"><button class="btn primary" type="button" id="wRetry">Reintentar</button><button class="btn ghost" type="button" id="wClose">Cerrar</button></div>');
    $("#wRetry").addEventListener("click", () => { closeSheet(); retryNow(); });
    $("#wClose").addEventListener("click", closeSheet);
    return;
  }
  const ms = sortedMembers();
  openSheet(
    "<h2>¿Quién eres?</h2>" +
    '<p class="sheet-note">' + (REMOTE ? "Toca tu perfil y escribe tu PIN. Este móvil lo recordará." : "Se recuerda en este dispositivo. Los perfiles con 🔒 piden PIN.") + "</p>" +
    '<div class="whos">' + ms.map((m) =>
      '<button type="button" data-id="' + esc(m.id) + '" aria-pressed="' + (m.id === meId) + '">' + av(m, "lg") + esc(m.name) +
      '<span class="lock">' + (m.role === "admin" ? "★ Admin " : "") + (hasPin(m) ? "🔒" : "") + "</span></button>").join("") + "</div>" +
    '<div class="btn-stack">' + (meId ? '<button class="btn ghost" type="button" id="wOut">Salir (no elegir a nadie)</button>' : "") + "</div>"
  );
  $$(".whos button").forEach((b) => b.addEventListener("click", () => {
    const m = member(b.dataset.id); if (!m) return;
    if (m.id === meId) { closeSheet(); return; }
    const hello = () => { closeSheet(); toast("Hola, " + m.name); };
    if (REMOTE) openPin(m, hello);                       // con servidor, siempre con PIN
    else if (hasPin(m)) openPin(m, () => { setMe(m.id); hello(); });
    else { setMe(m.id); hello(); }
  }));
  const out = $("#wOut"); if (out) out.addEventListener("click", () => { closeSheet(); logout(); });
}

function openPin(m, onOk){
  openSheet(
    '<div style="display:flex;justify-content:center;margin:6px 0 10px">' + av(m, "lg") + "</div>" +
    '<h2 style="text-align:center">PIN de ' + esc(m.name) + "</h2>" +
    '<div class="field" style="margin-top:14px"><input id="pIn" class="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-label="PIN"></div>' +
    '<p class="err" id="pErr" style="text-align:center"></p>' +
    '<div class="btn-stack"><button class="btn primary" type="button" id="pGo">Entrar</button><button class="btn ghost" type="button" id="pBack">Volver</button></div>'
  );
  const fail = (msg) => { $("#pErr").textContent = msg; $("#pIn").value = ""; $("#pIn").focus(); };
  if (REMOTE && !hasPin(m)) {
    $("#pIn").disabled = true; $("#pGo").disabled = true;
    $("#pErr").textContent = "Este perfil aún no tiene PIN. Pide a un adulto que te lo ponga en «Familia».";
  }
  const go = async () => {
    const v = $("#pIn").value.trim();
    if (!v) return;
    if (!REMOTE) { if (await hashPin(v) === m.pin_hash) onOk(); else fail("PIN incorrecto"); return; }
    const btn = $("#pGo"); btn.disabled = true; btn.textContent = "Comprobando…";
    try {
      const r = await rpc("fh_login", { p_home: HOME, p_member: m.id, p_pin: v });
      if (!r || r.error) { btn.disabled = false; btn.textContent = "Entrar"; fail(r ? r.error : "Sin respuesta"); return; }
      setSession(r.token, r.member);
      onOk();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Entrar";
      fail(navigator.onLine ? "No se ha podido conectar. Inténtalo otra vez." : "Sin conexión: hace falta internet para entrar.");
    }
  };
  $("#pGo").addEventListener("click", go);
  $("#pIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("#pBack").addEventListener("click", openWho);
  setTimeout(() => { const el = $("#pIn"); if (el) el.focus(); }, 120);
}

/* ---------------------------------------------------------------
   8. Arranque
   --------------------------------------------------------------- */
function afterLoad(){
  if (me() || sheet.open) return;
  if (!state.members.length && !confirmed) return;
  if (meId && !me()) meId = "";            // ese perfil se borró
  setTimeout(() => { if (!me() && !sheet.open) openWho(); }, 300);
}

function start(){
  const cached = readLS(CACHE_KEY, null) || {};
  state = EMPTY();
  KINDS.forEach((k) => { if (Array.isArray(cached[k])) state[k] = cached[k]; });
  outbox = readLS(OUT_KEY, []) || [];
  photos = readLS(PHOTO_KEY, {}) || {};
  try { meId = localStorage.getItem(ME_KEY) || ""; } catch(e){}
  try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch(e){}
  if (REMOTE && !token) meId = "";           // con servidor, sin pase no hay perfil elegido
  try { const t = sessionStorage.getItem("funnyhouse.tab"); if (TABS.some((x) => x.id === t)) tab = t; } catch(e){}
  if (state.members.length) loaded = true;   // con caché se puede pintar ya

  document.getElementById("fab").addEventListener("click", () => {
    if (tab === "premios") { if (isAdmin()) openRewardForm(null); return; }
    if (tab === "familia") { if (isAdmin()) openMemberForm(null); return; }
    if (!me()) { openWho(); return; }
    openTaskForm({ kind: tab === "estudios" ? "estudio" : "casa" });
  });
  document.getElementById("whoBtn").addEventListener("click", openWho);

  if (!REMOTE) showBanner("local");
  render();
  if (REMOTE) {
    if (!navigator.onLine) { setStatus("offline", "Sin conexión"); showBanner("offline"); }
    flush();
    refresh();
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (outbox.length) flush(); else refresh();
    }, 10000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { flush(); refresh(); } });
    window.addEventListener("online", () => { hideBanner("offline"); setStatus("saving","Guardando…"); flush(); refresh(); });
    window.addEventListener("offline", () => { setStatus("offline", "Sin conexión"); showBanner("offline"); });
  }
  if (loaded) afterLoad();

  // a medianoche cambian las tareas del día
  let day = toISO(today0());
  setInterval(() => { const t = toISO(today0()); if (t !== day) { day = t; render(); } }, 60000);
}

start();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => {});
  });
  // Cuando se activa una versión nueva, recargar una vez para usarla ya
  // (salvo que haya una ventana abierta, para no perder lo que se está escribiendo).
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    if (sheet.open) { toast("Hay una versión nueva: se usará al cerrar la app"); return; }
    reloading = true; location.reload();
  });
}
})();
