# FunnyHouse

Las tareas de casa, los estudios y los premios de toda la familia.
Web app instalable, hermana de Despensar. Cada miembro entra con su perfil y su PIN.

## Qué hace

- **Hoy**: lo que le toca a cada uno hoy, con barra de progreso y sus puntos.
  Los admin ven aquí la cola de **Por revisar** (tareas marcadas) y los **premios pedidos**.
- **Casa**: tareas puntuales, diarias, de entre semana o semanales. Para alguien en concreto,
  para **«cualquiera»** (la hace uno, el primero que pueda) o para **«todos»** (cada uno la
  suya: hacer la cama, lavarse los dientes…). En las de «todos» cada uno la marca por su
  cuenta, gana sus puntos, y en la lista se ve el progreso (p. ej. «Todos · 2/3»).
- **Favoritos**: al crear o editar una tarea, un admin puede activar «Guardar como favorito».
  Sale arriba en «Nueva tarea»: un toque rellena título, tipo, repetición, puntos, revisión y
  notas (no la persona). Se gestionan en Familia → «Tareas favoritas». Necesita `security.sql`
  actualizado.
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
| Ver la casa (después de entrar con su PIN) | ✔ | ✔ |
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

1. **Preparar Supabase**: en el proyecto de `config.js` → *SQL Editor* → *New query*,
   pega `schema.sql` y pulsa *Run*. Después, en otra consulta, `security.sql` y *Run*.
   Los dos se pueden volver a ejecutar sin perder nada.
2. **Publicar**: igual que Despensar. Repositorio nuevo en GitHub (p. ej. `funnyhouse`),
   sube todos los archivos respetando las carpetas `icons/` e `img/`, y en Settings → Pages
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
security.sql             PIN, permisos y guardado seguro (funciones del servidor)
sw.js                    abre al instante y funciona sin conexión
manifest.webmanifest     para instalarla como app
icons/                   iconos
img/                     ilustración de bienvenida
```

## Seguridad

- **Nadie lee ni escribe la base de datos directamente.** La clave pública de `config.js`
  solo puede llamar a unas pocas funciones de `security.sql`.
- **El PIN se comprueba en Supabase**, se guarda cifrado (bcrypt) y nunca sale del servidor.
  Tras 5 intentos fallidos, ese perfil se bloquea 10 minutos.
- Al entrar, el móvil recibe un **pase de sesión**. Cambiar el PIN de alguien cierra sus
  sesiones en los otros móviles; «Salir» cierra la del móvil actual.
- **Cada cambio se comprueba en el servidor** con las reglas de la tabla de arriba
  (solo un admin aprueba, da puntos, crea premios, cambia fotos…), y se guarda en lotes
  que se aplican enteros o no se aplican.
- Todos los miembros necesitan PIN. Lo que queda abierto: con la dirección y el
  identificador de la casa se ven los nombres y dibujos de los perfiles (no las fotos
  ni las tareas), para poder elegir quién eres.
