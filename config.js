/* =====================================================================
   FunnyHouse — configuración
   ---------------------------------------------------------------------
   Usa el mismo proyecto de Supabase que Despensar (las tablas de
   FunnyHouse llevan el prefijo fh_ y no se mezclan con las otras).
   Antes del primer uso hay que crear esas tablas: ver schema.sql.
   ===================================================================== */

window.FUNNYHOUSE_CONFIG = {

  /* La dirección de tu proyecto de Supabase. */
  supabaseUrl: "https://hokdzwfprpsaxfuhnlhi.supabase.co",

  /* La clave pública del MISMO proyecto (Project Settings → API Keys):
     la «anon public» (empieza por eyJ…) o la «publishable» (sb_publishable_…).
     Está pensada para ir dentro de la página. NUNCA pongas aquí la secret / service_role. */
  supabaseKey: "sb_publishable_ZTzjc7w-zmtf9GNkC453dA_1LTAMXx2",

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
