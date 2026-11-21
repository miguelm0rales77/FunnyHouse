/* =====================================================================
   FunnyHouse — configuración
   ---------------------------------------------------------------------
   Usa el mismo proyecto de Supabase que Despensar (las tablas de
   FunnyHouse llevan el prefijo fh_ y no se mezclan con las otras).
   Antes del primer uso hay que crear esas tablas: ver schema.sql.
   ===================================================================== */

window.FUNNYHOUSE_CONFIG = {

  /* La dirección de tu proyecto de Supabase. */
  supabaseUrl: "https://kikkqgocuvrkbhklrrkt.supabase.co",

  /* La clave pública (anon). Está pensada para ir dentro de la página. */
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2txZ29jdXZya2Joa2xycmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1ODc1NzcsImV4cCI6MjEwMzE2MzU3N30.N7cdvjE7Z_mLwZHqR0xNi0aoMDHZLPMvbMM9Q6WYokY",

  /* El identificador de vuestra casa. Separa vuestros datos de los de
     cualquier otra familia que use la misma base de datos.
     Una vez empecéis a usar la app NO lo cambies. */
  home: "funnyhouse-morales-8k2p",

  /* true = no usa Supabase: todo se guarda solo en este navegador.
     Sirve para probar la app antes de crear las tablas. */
  localOnly: false,

  /* Opcional: dirección de Despensar, para tener un acceso directo. */
  despensarUrl: ""

};
