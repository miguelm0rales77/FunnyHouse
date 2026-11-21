# FunnyHouse

Las tareas de casa, los estudios y los premios de toda la familia.
Web app instalable, hermana de Despensar: mismo funcionamiento, misma base de datos.

## Qué hace

- **Hoy**: lo que le toca a cada uno hoy, con barra de progreso y sus puntos.
  Los admin ven aquí la cola de **Por revisar** (tareas marcadas) y los **premios pedidos**.
- **Casa**: tareas puntuales, diarias, de entre semana o semanales. Para alguien en concreto
  o para «cualquiera» (se la lleva quien la haga primero).
- **Turnos rotativos**: en una tarea que se repite, elige 2 o más personas en orden
  y la app reparte sola a quién le toca cada día (o cada día laborable, o cada semana).
  Un admin puede «pasar el turno al siguiente» si alguien no puede ese día.
- **Estudios**: deberes, exámenes (con cuenta atrás y nota), trabajos, lectura y rutina de estudio.
- **Premios**: marcador de la familia, catálogo de premios y el historial de puntos de cada uno.
- **Familia**: perfiles con foto (o dibujo) y color, permisos, PIN y puntos extra o penalizaciones.
  Las fotos solo las ponen o cambian los admin; se recortan y reducen solas (unos pocos KB).
- Funciona **sin cobertura**: lo que marques se sincroniza al volver la red.

## Quién puede hacer qué

| | Admin (padres) | Miembro (hijos) |
|---|---|---|
| Ver todo | ✔ | ✔ |
| Marcar sus tareas y las de «cualquiera» | ✔ (y las de todos) | ✔ |
| Apuntar tareas y deberes **para sí mismo** | ✔ | ✔ (sin puntos) |
| Asignar tareas a otros y poner puntos | ✔ | — |
| Aprobar o rechazar tareas | ✔ | — |
| Crear premios y conceder los pedidos | ✔ | — |
| Pedir un premio | ✔ | ✔ (si le llegan los puntos) |
| Puntos extra, penalizaciones, gestionar la familia | ✔ | — |
| Poner o cambiar fotos de perfil | ✔ | — |

Cuando un miembro marca una tarea queda **Por revisar** y los puntos llegan al aprobarla.
Se puede desactivar la revisión en cada tarea («Un adulto la aprueba»).

## Puesta en marcha

1. **Crear las tablas**: en Supabase → *SQL Editor* → *New query*, pega `schema.sql` y pulsa *Run*.
   Usa el mismo proyecto que Despensar; las tablas llevan el prefijo `fh_`.
2. **Publicar**: igual que Despensar. Repositorio nuevo en GitHub (p. ej. `funnyhouse`),
   sube todos los archivos respetando la carpeta `icons/`, y en Settings → Pages
   elige la rama `main`, carpeta `/ (root)`.
3. Abre la web: lo primero que pide es crear el perfil del primer admin (con PIN).
   Después, en **Familia → Añadir miembro**, das de alta al resto.
4. Cada uno abre la web en su móvil, la instala («Añadir a pantalla de inicio») y elige su perfil.

**Probar sin tocar datos reales**: añade `?local=1` a la dirección. Todo se guarda solo en ese navegador.

## Estructura

```
index.html               interfaz y estilos
app.js                   la lógica
config.js                Supabase, identificador de la casa, enlace a Despensar
schema.sql               las tablas de Supabase
sw.js                    abre al instante y funciona sin conexión
manifest.webmanifest     para instalarla como app
icons/                   iconos
```

## Aviso honesto sobre seguridad

Igual que Despensar, no hay cuentas: quien tenga la dirección puede abrir la app.
Los permisos y el PIN se comprueban **en la propia app**, lo que basta para el día a día
en familia, pero alguien con conocimientos técnicos podría saltárselos llamando a la base
de datos directamente. Si algún día hace falta blindarlo, el camino es activar
autenticación en Supabase y mover las acciones de admin a funciones del servidor.
