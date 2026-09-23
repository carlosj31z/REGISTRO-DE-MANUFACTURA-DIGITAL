# RMD Pendientes de Autorización — Lógica de funcionamiento

Este documento explica **cómo funciona por dentro** `index.html` (una SPA de un solo archivo, sin build ni backend propio), con foco especial en la pestaña **Producción**, que es el corazón de la app: cruza el Programa de Producción con el árbol de producción de cada producto (listas de materiales de SAP) y los RMD de SAP para decirte, producto por producto y etapa por etapa, qué le falta autorización.

Está escrito para que puedas decidir **qué tocar** al mejorar Producción sin romper el resto. Cada sección indica el rango de líneas aproximado en `index.html` para ubicarte rápido.

---

## 1. Panorama general

- **Un solo archivo HTML** (~10.300 líneas) con `<style>` (CSS, variables de tema) + `<script>` (toda la lógica) + HTML de las 4 pestañas. No hay bundler, no hay módulos ES, no hay backend propio: todo corre en el navegador.
- **Librerías por CDN**: Tailwind (config inline, ver más abajo), FullCalendar (calendarios), Chart.js (gráficos), `xlsx-js-style` (leer/escribir Excel), Day.js (fechas), SweetAlert2 (todos los diálogos/modales), GSAP (animaciones de transición), html2canvas (exportar gráficos como imagen), localForage (IndexedDB), Supabase JS SDK (persistencia + realtime), y un script externo `arbol-motor.js` (motor de árbol de materiales BOM de SAP, para el filtrado por árbol).
- **4 pestañas** controladas por `currentTab` / `switchTab()` (línea ~3637): `forecast`, `produccion`, `rmd` (llamada en la UI "OP sin RMD"), `seguimiento` (una app secundaria completa, embebida como HTML en base64 en `SEGUIMIENTO_RMD_HTML_B64` y cargada en un `<iframe>` la primera vez que se abre esa pestaña — está fuera del alcance de este documento).
- **Persistencia**: cada pieza de estado importante se guarda con `storeSet(key, value)` / se lee con `storeGet(key)` (línea ~3054). Este par de funciones son el único punto de entrada a la persistencia en toda la app — nunca se llama a Supabase o a IndexedDB directamente desde el resto del código.
- **Multi-dispositivo en vivo**: Supabase Realtime (línea ~3161) escucha cambios en la tabla KV y refresca la parte de pantalla afectada en cualquier otra pestaña/dispositivo abierto, sin recargar la página.
- **Trazabilidad**: antes de cargar o borrar cualquier archivo, se pide un DNI (`pedirDNI`, línea ~3242) que se valida contra un directorio fijo en el código (`DNI_DIRECTORIO`) y queda registrado en un historial (`registrarHistorial`).

### 1.1 Paleta y tema (referencia rápida, no es el foco de este doc)

El tema oscuro/claro se resuelve con variables CSS (`--accent`, `--slate-*`, etc.) redefinidas bajo `html[data-theme="light"]`, y Tailwind está configurado (script inline justo después de `<script src=".../tailwind.js">`) para que sus clases de color (`slate`, `amber`, `emerald`...) resuelvan a esas mismas variables — así una sola clase de Tailwind cambia de color solo con el atributo `data-theme`, sin tocar el HTML.

---

## 2. La pestaña Producción: mapa de piezas

Producción cruza **2 fuentes** (cada una con su botón de carga en la barra superior, `#inlineUploadProd`) con el **árbol de producción** de cada producto (listas de materiales de SAP):

| Fuente | Variable(s) | De dónde sale | Qué aporta |
|---|---|---|---|
| **Programa de Producción** | `productionData` (array) | Un Excel por planta (Planta ATE / Planta LIMA), varias hojas (una por área) | Qué se va a producir y CUÁNDO (fechas) |
| **RMD de SAP** | `rmdPrecisoDatos` / `rmdPreciso` (+ `rmdAutorizadosDetalle` para la observación) | Recomendado: **sin archivo**, con el botón **"Enviar a Status RMD"** del portal (trae todas las versiones y todas las recetas). También acepta el Exportado RMD (sección 4.8) | El estado de cada RMD y con qué materiales (recetas) se usa |
| **Árbol de producción** | `motorArboles`, `arbolDeProduccion()` | Motor local de "Listas de materiales" (`arbol-motor.js` + 4 tablas, caché 12 h) | Qué etapas tiene cada producto y con qué material exacto se hace cada una |

La **Base de Datos** (material → Código Agrupador) y el Código Agrupador **ya no se usan** para validar; su botón sigue ahí, pero su estado dice "No se usa".

La función que lo cruza todo es **`runValidacionMateriales()`** — es, con diferencia, la función más importante de toda la pestaña. Todo lo demás (KPIs, tabla, calendario, gráficos) se recalcula a partir de su resultado.

```
Excel Programa de Producción ──┐
                                 ├─► runValidacionMateriales() ──► ultimoResultadoValidacion
RMD de SAP (con recetas)       ──┤     por cada producto:          { pendientes[], autorizadosManual[],
                                 │     evaluarMaterialPreciso()      revisados, autorizados, rmdPendientes }
Árbol de producción (BOM SAP)  ──┘                                          │
                                                                              ▼
                                                          renderTablaPendientes() + KPIs + calendario + gráficos
```

### 2.1 Estado en memoria de Producción (variables clave)

Declaradas cerca de la línea 2900 y 5300:

```js
let currentPlanta = 'planta2';       // 'planta1' (ATE) | 'planta2' (LIMA) | 'consolidado'
let productionData = [];             // [{ codigo, producto, area, fechas:[...], planta? }]
let availableAreas = new Set();      // nombres de hoja/área presentes en el Excel cargado
let currentAreaFilter = 'TODAS';     // filtro de pestañas de área (chips debajo del header)

let rmdPrecisoDatos = null;          // maestro de RMD que se guarda (val_rmd_preciso): una fila compacta por RMD
let rmdPreciso = null;               // su índice en memoria: porMatEtapa ("material::ETAPA" -> RMD), etapasPropias, descDeMaterial
const motorArboles = { estado };     // 'pendiente' | 'cargando' | 'listo' | 'no-disponible' (motor de árboles)
let rmdAutorizadosDetalle = [];      // una fila por RMD del Exportado (de aquí sale la Observación de cada RMD)
// Ya no intervienen en la validación: databaseMaterials, agrupadorEtapasMap, rmdAutorizadosEtapasPorAgrupador

let manualAutorizados = new Set();   // claves "material::ETAPA_FIJA" marcadas ✓ a mano
let estatusEtapa = new Map();        // "material::ETAPA_FIJA" -> 'PENDIENTE-PRO' | 'POR INGRESAR' | ...
let responsablesEtapa = new Map();   // "material::ETAPA_FIJA" -> 'PRO' | 'DOC' | 'ASC' | 'IDE'
let descartadosPorArbol = new Set(); // filtro de árbol ANTIGUO (por agrupador); ya no se usa en la validación

let ultimoResultadoValidacion = { revisados, autorizados, pendientes:[...], autorizadosManual:[...], rmdPendientes };
```

Todas estas colecciones (salvo `productionData`, que vive bajo `prod_data_<planta>`) se guardan bajo claves `val_*` en Supabase/IndexedDB y se recargan al arrancar con `loadValidacionData()` (línea ~7500).

---

## 3. Carga y parseo del Programa de Producción (la parte más delicada)

Esta es la lógica más frágil de toda la app, porque **el formato del Excel de origen no es estable**: cambia entre Planta ATE y Planta LIMA, y dentro de la misma planta puede haber hojas con formato antiguo y nuevo mezcladas. Vale la pena entenderla bien antes de tocar nada aquí.

### 3.1 Flujo

1. El usuario sube un `.xlsx` → `handleFileProd(e)` (línea ~4423) pide el DNI (`autorizarYRegistrar`) y, si se aprueba, llama a `processFileProd(file)` (línea ~4486).
2. `processFileProd` **captura `currentPlanta` en una variable local (`plantaObjetivo`) antes de leer el archivo** — como la lectura es asíncrona (`FileReader`), si el usuario cambia de planta mientras se procesa, el archivo se sigue tratando como de la planta que estaba activa al iniciar la carga. Este patrón ("capturar el contexto antes de un `await`") se repite en varias partes de la app — es la defensa estándar contra condiciones de carrera con el usuario interactuando durante una operación async.
3. Se lee el workbook completo con `XLSX.read`, y se recorre **hoja por hoja** (`wb.SheetNames.forEach`). Cada hoja = un área de producción (SOL, ACO, INY, COS, CAP BLAN, SOL HORM, SOL COLOR, SEM, MEN, REA, PEF...).
4. Por cada hoja se extrae una lista de productos con sus fechas programadas, y todo se acumula en un `Map` (`pmap`) con clave `` `${codigo}_${areaHoja}` `` — es decir, **el mismo código de material en dos áreas distintas cuenta como dos entradas separadas** (porque puede tener etapas pendientes distintas en cada área).
5. Al final se guarda con `storeSet('prod_data_<planta>', { data, areas })` y, si ya había una versión anterior de esa planta, se genera un snapshot de trazabilidad (sección 6).

### 3.2 Por qué el parseo de fechas es tan complejo

El Programa de Producción no trae "una fecha por celda" de forma simple. Hay dos formatos según la planta:

**Planta ATE (`planta1Format = true`)** — `buildDateColumnMapPlanta1()` (línea ~4240):
- Una fila con etiquetas de semana tipo `S37`, `S38`... (formato corto).
- Debajo, una fila de encabezados de columna (día de la semana implícito por posición: offset 0 = lunes, offset 6 = domingo).
- La fecha real de cada columna se **reconstruye matemáticamente**: `isoWeekMonday(37) + offset días`, no se lee un valor de fecha literal de la celda.

**Planta LIMA (`planta1Format = false`)** — `buildDateColumnMap()` (línea ~4396), con dos variantes que se auto-detectan:
- **Formato nuevo**: las fechas vienen como objetos `Date` reales, directamente en la fila de "Código" o en la siguiente.
- **Formato antiguo**: la fila de fechas trae **números de día sueltos** (7, 8, 9...) bajo encabezados de día de la semana (L, M, M, J, V, S, D), y hay que reconstruir la fecha completa combinando esos números con el bloque de semana (`SEM31`, etc.) más cercano arriba.
- La detección de cuál formato es se hace **contando** cuántas celdas de la fila de "Código" vs. la fila siguiente parecen fechas reales (`scoreDirectDates`), y se usa la que tenga más.

**El "mapa global de semanas" (`buildGlobalWeekMondayMap()`, línea ~4270)** es una pieza aparte: como una misma etiqueta de semana (ej. `S37`) puede aparecer en varias hojas del mismo libro, y no todas tienen una fecha directa ancla, se hace **una pasada completa por todo el workbook primero** para capturar cualquier fecha real y asociarla a su número de semana, y **solo después** (segunda pasada) se rellenan por cálculo ISO las semanas que sigan sin fecha. El comentario en el código documenta un bug real de versiones anteriores donde el orden de las hojas hacía que un respaldo calculado (equivocado) se escribiera antes de que apareciera la fecha real correcta en otra hoja — por eso ahora está separado en dos pasadas explícitas.

### 3.3 Filtrado de filas que no son "producción real"

- `containsExcludedTermPlanta1` / `containsExcludedTermPlanta2` (línea ~4152): celdas cuyo contenido es un término como `LIMP`, `VAL`, `SETUP`, `MTTO` (ATE) o `MMTO`, `MTO`, `MAN` (LIMA) se ignoran — no cuentan como fecha programada aunque estén dentro del rango de columnas de fecha.
- Ciertas hojas completas se excluyen según la planta: `REA` se excluye solo en Planta LIMA; `SOP BEB`, `SOP P1`, `SOP P2` se excluyen solo en Planta ATE.
- El código de material debe matchear `^[56]\d{9}$` (10 dígitos, empieza con 5 o 6) — cualquier otra cosa en la columna "Código" se descarta.
- `filtrarFechasFuturas()` → `isDentroDeVentanaProduccion()` — solo se conservan fechas desde el **lunes de la semana actual**; lo programado solo en semanas anteriores se descarta como si ya no aplicara.
- **Semanas sin año** (`buildDateColumnMap`): algunas hojas de Planta LIMA (MENT, SEM, COS) traen el historial de todo el año, desde "SEMANA N° 45" del año anterior hasta la semana actual, con "SEMANA N° 53/54/55" en el cambio de año y números de día sueltos. El número de semana no dice el año y un bloque viejo caía en el año actual o el siguiente (caso real: el bloque "N° 53" de fin de 2025 terminaba en 01/01/2027 y MENTHOLATUM 6000003525 aparecía programado a futuro). Ahora el número de día del encabezado desambigua: si no coincide con la fecha reconstruida y sí con la misma semana un año antes (o después), se usa esa. Comprobado contra una lectura independiente en Python de ambos programas: mismos productos por hoja.

### 3.4 Planta ATE, Planta LIMA y Consolidado

`switchPlanta(planta)` (línea ~4819) cambia `currentPlanta` y llama a `loadProdData()`:

- `'planta1'` / `'planta2'` → lee directamente `prod_data_planta1` / `prod_data_planta2`.
- `'consolidado'` → `loadProdDataConsolidado()` (línea ~4774): trae **ambas** claves en paralelo y las fusiona en un solo array, etiquetando cada producto con `planta: 'planta1' | 'planta2'` (usado solo para mostrar de dónde viene, no afecta el cruce por código).
- El botón "Consolidado" está deshabilitado hasta que **ambas** plantas tengan datos (`updateConsolidadoBtnState()`, línea ~4805, se llama después de cada carga/borrado). Si el usuario está en consolidado y una planta se queda sin datos, la app lo saca automáticamente de vuelta a Planta LIMA.

### 3.5 Archivo original y trazabilidad de carga

Cada carga guarda también el Excel original en base64 (`prod_archivo_original_<planta>`) para poder re-descargarlo tal cual se subió (botón "✓ Cargado"), junto a la fecha/hora de última carga.

---

## 4. Validación por árbol de producción: `runValidacionMateriales()`

Solo necesita el **Programa de Producción** y los **RMD de SAP**; si falta alguno deja la tabla vacía con un mensaje que dice cuál. La primera vez del día espera a que cargue el motor de árboles ("Cargando el árbol de materiales de SAP…", `esperarMotorArboles`); después cada validación tarda ~50 ms. Forecast (`runValidacionForecast`) usa exactamente la misma lógica.

### 4.1 Paso 1 — Agrupar por código de material (todas las áreas)

Recorre `productionData` (respetando `currentAreaFilter` si no es `'TODAS'`) y arma, por código: sus áreas (`materialAreas`), sus plantas (`materialPlantas`, relevante en consolidado), su fecha de inicio más próxima (`materialFechaMin`, para ordenar la tabla y el chip de urgencia) y su descripción del programa (respaldo).

### 4.2 Paso 2 — El árbol de producción de cada producto (`calcularArbolProduccion`)

El árbol se calcula **hacia atrás desde el propio código**: un producto terminado arranca en Acondicionado; un semielaborado del programa (ampolla llena, granel…) arranca en su propia etapa, así que solo cuentan su etapa y las anteriores. Cada árbol se calcula al momento (163 productos en ~5 ms) y nunca se reutiliza uno de otra sesión: siempre corresponde a la lista de materiales vigente.

Un código puede tener varias **alternativas** de lista de materiales y cada una varias **versiones de fabricación**. Cuentan solo las **rutas vigentes**:
- alternativa normal (no 66–90 de conciliación ni 95–99 de reacondicionado),
- lista de materiales **activa**,
- con versión de fabricación **real** (registrada en SAP),
- sin versiones de fabricación **bloqueadas** ni materiales con **estado Z** (bloqueo) en el camino.

Antes se tomaba siempre la alternativa de menor número aunque estuviera inactiva (casos reales: AKA-PRED 6000000814, cuya alternativa 1 inactiva no tenía Fabricación; NISTATINA 6000000997, cuya alternativa 1 inactiva solo tenía Acondicionado y por eso no se revisaban su Envase ni su Fabricación). Si hay **varias rutas vigentes** (dos líneas, dos versiones de fabricación), cada etapa lleva los materiales de todas (ej. DOLORAL FTE 6000003645: Fabricación 5000003208 por la versión 1101 y 5000003663 por la 1201). Si ninguna ruta es vigente se usan las que haya y se avisa en la ventana de la etapa.

### 4.3 Paso 3 — El estado de cada etapa (`evaluarEtapaArbol` + `estadoDeCadenaPrecisa`)

Para cada material que el árbol asigna a la etapa, su *cadena* son todos los RMD de ese material (como receta o como Código por Defecto) en esa etapa, de cualquier máster:
1. Los **Cancelados** no cuentan.
2. Si en la cadena hay un RMD **vigente** (Autorizado o Ingresado), las versiones **Suspendidas** se apartan: SAP suspende la anterior al autorizar la nueva, y un material puede ser receta de dos másters con numeración de versión distinta. Una solicitud (Aprobada/Rechazada) no basta para apartarlas.
3. Manda la **versión más alta**; en empate gana la no resuelta y después el RMD real sobre la solicitud.
4. Si el elegido está resuelto pero hay un RMD **Ingresado** o una solicitud **Solicitada** registrados DESPUÉS de él (otra línea de versiones), la etapa queda pendiente: hay una versión nueva en curso.
5. Resuelto = Autorizado, Solicitud Aprobada o Solicitud Rechazada (criterio de siempre); pendiente = Ingresado, Suspendido, Solicitado o **Sin RMD**.

La etapa está pendiente si el material de **alguna** de sus rutas vigentes lo está.

### 4.4 Productos sin árbol

Si un código no tiene lista de materiales en SAP (o no se pudo cargar el motor), solo se revisa el RMD de su propio código. Si su etapa es **Fabricación** no hay nada antes y la revisión está completa; si no, el producto sale para revisar con el motivo "Sin árbol de producción: …" y la nota "etapas anteriores sin verificar" (nunca se da por autorizado a ciegas). Si el motor no carga, un aviso fijo sobre la tabla lo dice y ofrece **Reintentar** (`avisoMotorArboles`).

### 4.5 Paso 4 — Restar lo autorizado manualmente

Las etapas pendientes se filtran solo contra `manualAutorizados` (botón ✓ de una etapa). Si no queda ninguna, el producto pasa a `autorizadosManual`; si quedan algunas, sigue pendiente mostrando las que faltan más las autorizadas a mano (para poder revertir cada una). El antiguo descarte por árbol (`descartadosPorArbol`) ya no interviene y se quitó su opción del menú **Revertir**.

### 4.6 Resultado final

```js
ultimoResultadoValidacion = {
  revisados,               // total de materiales únicos evaluados
  autorizados: autorizados + autorizadosManualLista.length,
  pendientes: pendientesReales,       // [{ material, descripcion, areas, etapasPendientes:[...], detallePreciso, sinArbol?, fechaProxima, plantas, motivo }]
  autorizadosManual: autorizadosManualLista,
  rmdPendientes: rmdPendientesTotal   // SUMA de etapas pendientes individuales, no de productos
};
```

`rmdPendientes` es el número del KPI destacado "RMD Pendientes" — cuenta **etapas**, no productos. La lista se ordena por `fechaProxima` ascendente (lo más urgente primero).

### 4.7 En la pantalla y en el Excel

- **Chip** bajo cada etapa pendiente (`chipSapEtapa`): estado real en SAP (`Ingresado v4`, `Suspendido v2`, `Solicitado v9`, `Sin RMD`); con varias rutas, `+N`. El tooltip lista cada código con su RMD.
- **Clic en la etapa** (`mostrarDetalleEtapa` → `mostrarEtapaPrecisa`): solo el código (o los códigos, uno por ruta vigente) de esa etapa y el RMD que decide su estado — número de RMD o de solicitud, versión, estado, fecha de registro y **Observación** (`filaDetalleDeEntrada`) —, la explicación de por qué está pendiente, las rutas del árbol con la etapa resaltada y, plegado, el historial de versiones de ese mismo código.
- **Exportar Excel** (Producción y Forecast): las columnas de etapa van en orden de producción y la hoja **Detalle SAP** tiene una fila por código pendiente con su ruta, RMD, versión, estado, registro y observación (`hojaDetalleSap`).
- Junto a "Exportado RMD" se lee **✓ Por árbol** y, en las fuentes, la fecha de los datos de SAP (`textoFuenteRmd`).

### 4.8 El maestro de RMD: SAP o Exportado

- **Con recetas** (botón "Enviar a Status RMD", o un Excel con las columnas `Linaje`, `Código Receta`…): reemplaza el maestro completo (`datosPrecisosDesdeFilas`). Se guarda en `val_rmd_preciso` (≈2 MB): una fila por RMD `[rmd, linaje, versión, estado, etapa, agrupador, código por defecto, descripción, [[material, versión de fabricación]…], fechaRegistroMs, códigoSolicitud]`.
- **Exportado clásico** (sin recetas): ya no hace volver a ninguna lógica por agrupador. Sus estados se **suman** al maestro existente (`fusionarDatosPrecisos`): se conservan las recetas de la última sincronización, un estado solo **avanza** (Solicitado → Solicitud Aprobada/Rechazada → Ingresado → Autorizado → Suspendido/Cancelado; un Exportado más viejo no retrocede nada) y los RMD nuevos cuentan por su Código por Defecto hasta la próxima sincronización. Si no había maestro, se usa ese Exportado solo y la fuente dice "sin recetas".
- Al abrir la página, si solo hay datos de un Exportado clásico guardado (de antes de esta versión), la validación por árbol funciona igual con ellos (`datosPrecisosDesdeDetalle`).

**Resultado medido** con los programas ATE del 17/09/2026 y LIMA de las semanas 38–40 y el maestro de SAP del 23/09/2026 (autorizados / pendientes / etapas pendientes): ATE, 65 productos, 22 / 43 / 69 con la antigua lógica por agrupador → **51 / 14 / 21**; LIMA, 98 productos, 68 / 30 / 51 → **65 / 33 / 51**. Los 163 productos tienen árbol; en LIMA 4 etapas tienen dos rutas vigentes. Verificación independiente (misma regla recalculada en Python desde el Excel crudo): 0 diferencias en 513 etapas y 517 códigos.

### 4.9 Enlace directo con el portal SAP (sin archivo)

El script de Tampermonkey del portal (`rmd-ui-mejoras.user.js` ≥ v1.17; v1.18 envía además la hora de registro; repo AUTOMATIZACION-DE-RMD) añade junto a "Exportar" el botón **Enviar a Status RMD**: abre esta página en otra pestaña, lee el maestro completo con sus recetas usando la sesión ya iniciada del portal (el mismo servicio OData que usa su propio botón Exportar) y lo pasa con `postMessage`. Protocolo: el portal envía `STATUS_RMD_PING` hasta que esta página responde `STATUS_RMD_LISTO` (solo cuando terminó de cargar), luego `RMD_SAP_MAESTRO` (`{ v:1, generado, columnas, filas }`) y esta página contesta `STATUS_RMD_RECIBIDO` (`{ ok, resumen | motivo }`). Aquí se pide el DNI como en cualquier carga ("Sincronización con SAP") y se procesa con el mismo `procesarFilasRmd` que un Excel subido (`recibirMaestroDesdeSap`). Tiempo medido: ≈8 s para 12 732 RMD.

**Por qué no un GET directo desde esta página a SAP:** la API del portal exige la sesión SSO de la persona (cookies del dominio de SAP), el navegador bloquea las llamadas entre dominios (CORS) y la alternativa —guardar un usuario técnico o credenciales en este repositorio público— sería un riesgo de seguridad. El enlace por pestañas reutiliza la sesión que la persona ya tiene abierta y no toca credenciales.

**Seguridad de mensajes** (listener de `message`): `STATUS_RMD_PING` y `RMD_SAP_MAESTRO` solo se aceptan desde el origen exacto del portal (`PORTAL_SAP_ORIGIN`) y cuando la app ya está lista; los mensajes `RMD_SEGUIMIENTO_*` solo desde el iframe de Seguimiento RMD (`event.source`). Antes cualquier página que abriera esta en una ventana podía enviarle mensajes.

**Tiempo real:** si otro dispositivo guarda datos de validación nuevos (`val_*`, incluido `val_rmd_preciso`), esta página los recarga (con 1,5 s de espera para agrupar las 7 escrituras) y vuelve a validar.

---

## 5. Las "5 etapas fijas" y el mapeo de estatus

Todo el sistema de etapas gira en torno a una lista fija, en el **orden de producción** (en los 4.528 árboles de SAP revisados, Inspección va siempre DESPUÉS de Envase: inyectables Fabricación › Envase › Inspección › Acondicionado). Es también el orden de las etapas en la tabla y de las columnas del Excel:

```js
const ETAPAS_FIJAS = ['FABRICACION', 'RECUBRIMIENTO', 'ENVASE', 'INSPECCION', 'ACONDICIONADO'];
```

Los Excel de origen escriben la etapa con texto libre y variable (ej. "Acondicionado Final", "ENV."), así que `mapEtapaAFija()` (línea ~6880) usa un diccionario de alias (`ETAPA_ALIASES`) más coincidencia parcial para normalizar cualquier variante al valor fijo correspondiente. Si el texto menciona **más de una** etapa fija a la vez (dato corrupto de origen), se trata como no reconocible en vez de adivinar.

### 5.1 Estatus de cada etapa pendiente y responsable automático

En la tabla, cada etapa pendiente de un producto tiene un `<select>` de **Estatus** (línea ~5360):

```js
const ESTATUS_ETAPA_OPCIONES = ['PENDIENTE-PRO', 'POR INGRESAR', 'FLUJO SAP', 'PEND RMD OFICIAL', 'PEND CC'];
const ESTATUS_ETAPA_RESPONSABLE_DEFECTO = {
  'PENDIENTE-PRO': 'PRO', 'POR INGRESAR': 'DOC', 'FLUJO SAP': 'PRO', 'PEND RMD OFICIAL': 'DOC'
  // 'PEND CC' NO tiene default: es responsabilidad compartida ASC/PRO, el usuario debe elegir a mano
};
```

`window.setEstatusEtapa(material, etapaFija, valor)` (línea ~5392) es el único punto que escribe en `estatusEtapa` y `responsablesEtapa` a la vez: el responsable **ya no es editable directamente** (dejó de ser un `<select>` libre), se deriva siempre del estatus elegido, salvo en `PEND CC` donde queda un segundo `<select>` (ASC/PRO) obligatorio antes de poder autorizar esa etapa (`toggleManualAutorizadoEtapa` lo bloquea explícitamente si falta elegir).

---

## 6. Historial de trazabilidad del Programa de Producción

Cada vez que se carga un Excel de Producción y ya existía una versión anterior guardada de esa misma planta, `registrarSnapshotProduccion()` (línea ~3340) compara ambas versiones material-por-área (`claveMaterial = codigo::area`) y clasifica cada diferencia en:

- **Desaparecidos**: tenía fecha(s) antes, ya no aparece.
- **Reprogramados**: sigue existiendo pero cambió al menos una fecha.
- **Nuevos**: no existía antes.

Se guardan hasta 30 snapshots por planta (`prod_historial_planta1` / `prod_historial_planta2`). El botón "Historial" del calendario de Producción abre un modal (`mostrarHistorialTrazabilidadProduccion`) con pestañas Planta ATE / Planta LIMA / Consolidado (el consolidado simplemente intercala los snapshots de ambas por fecha, no tiene almacenamiento propio) y un selector para navegar entre snapshots.

---

## 7. Árbol de materiales (BOM de SAP)

El árbol es ahora la **base de la validación** (sección 4.2). Esta sección describe de dónde sale; el "filtrado por árbol" de la 7.2 es la herramienta ANTIGUA para la lógica por agrupador y ya no interviene en la validación.

### 7.1 Qué es "el árbol"

Un producto real de SAP puede descomponerse en hasta 3 nodos de un BOM (Bill of Materials): **Fabricación** (semielaborado, a veces compartido entre presentaciones), **Envase**, **Acondicionado**. El "árbol de materiales" de un código es esa estructura calculada. Hay dos vías para obtenerlo, con fallback automático:

1. **Motor local** (preferido, sin red): se descargan 4 tablas (`mm_bom`, `mm_bom_componentes`, `mm_vfab`, `mm_materiales`) desde un proyecto Supabase **distinto** al de la app (línea ~5455), se cachean hasta 12h en IndexedDB, y se corre localmente el mismo motor de cálculo que expone la API remota (`arbol-motor.js`, cargado como `<script>` en el `<head>`). `precalentarMotorArbolLocal()` (línea ~5741) dispara esta descarga en segundo plano justo después de la carga inicial de la página, para que el primer filtrado no tenga que esperarla.
2. **API remota** (`ARBOL_MATERIALES_API`, en Vercel) como respaldo si el motor local no está disponible o no tiene datos. Con reintentos ante 5xx/timeout (hasta 5 intentos), pero nunca ante 404/400.

`consultarArbolMaterial(codigo)` (línea ~5853) es el punto de entrada único; cachea resultados exitosos en memoria (con persistencia diferida a `localStorage`) y también memoriza, solo en memoria de sesión, los códigos para los que el motor local respondió "sin árbol" de forma concluyente — para no volver a golpear la API remota con la misma pregunta.

### 7.2 (Antiguo, ya no se usa) Cómo se descartaban filas ajenas del agrupador

`aplicarFiltroArbolPersistente(material, etapaFijaUnica)` (línea ~6222) es la función central:

1. Consulta el árbol del material.
2. Para cada etapa a evaluar, busca todas las filas pendientes de `rmdAutorizadosDetalle` que compartan el mismo Agrupador y Etapa (vía `filasRmdPorAgrupadorEtapa()`, un índice construido una sola vez por referencia de array — línea ~5997).
3. Compara el **código propio** de esa etapa en el árbol contra el `codigoPorDefecto` de cada fila candidata. Las que no coinciden se marcan como "ajenas" y se agregan a `descartadosPorArbol` **con una clave específica a la vista del material que originó el filtro** (`responsableKeyVistaArbol`) — nunca una marca global sobre el código ajeno, para no ocultar por error la fila legítima de ese otro producto cuando se lo filtre directamente.
4. Excepción documentada en el código: si solo queda un candidato ajeno y el material que se filtra no tiene fila propia, se confirma por coincidencia de Fabricación entre ambos árboles (código de licitación vs. código de venta que comparten semielaborado) antes de descartar.

`filtrarTodosPorArbol(origen)` (línea ~6481) aplica esto a **todos** los productos pendientes de golpe: primero hace un *prefetch* en paralelo (con concurrencia limitada) de los árboles necesarios —solo lectura, no toca estado—, y luego aplica los descartes **estrictamente secuencial** (nunca en paralelo), porque procesar dos presentaciones del mismo agrupador al mismo tiempo puede hacer que se descarten mutuamente (bug real documentado en el código, con el caso CLINDESS T7/T2 MM). El guardado a Supabase se difiere y se hace una sola vez al final (`programarGuardadoDescartes`), no una vez por producto.

---

## 8. Render de la tabla "RMD Pendientes de Autorización"

`renderTablaPendientes(filas)` (línea ~7823) recibe la lista combinada de pendientes + autorizados manuales (`ultimoResultadoValidacion`) y:

- Guarda la lista completa en `window.__ultimasFilasValidacion` (para que los filtros de texto/estado/fecha puedan re-renderizar sin recalcular la validación completa — ver `refiltrarTablaPendientes()`).
- Aplica en cascada: filtro de estado (`validacionFiltroEstado`: todos/pendientes/autorizados), búsqueda de texto (`validacionBusqueda`, con debounce de 150ms en el input), filtro de fechas puntuales (`validacionFiltroFechas`, un popup tipo Excel sobre la columna "Inicio de Producción").
- Por cada fila, genera un bloque `.etapa-fila-grid` por etapa pendiente (con su `<select>` de Estatus, badge de responsable derivado, botón ✓ de autorización manual) y otro por cada etapa ya autorizada manualmente (con botón "Revertir").
- Calcula `urgenciaInicioHtml()` (línea ~7795): un chip visual según cuántos días faltan hasta la fecha de inicio de producción (`urg-vencido` si ya pasó, `urg-hoy`, `urg-pronto` si son 1–3 días, `urg-normal` en otro caso).
- Actualiza los contadores de los pills de filtro (`actualizarContadoresPendientes`) y el contador del panel (`actualizarContadorPanelRmd`).

---

## 9. Calendario, "Próximas a Producir" y gráficos de Producción

Todos se recalculan juntos desde `updateDashboardProd()` (línea ~4846), que es el punto de entrada que se llama tras cualquier cambio relevante (carga de archivo, cambio de filtro de área, cambio de planta):

```js
function updateDashboardProd() {
    runValidacionMateriales();
    renderFiltersProd(); renderKPIsProd(); renderCalendarProd(); renderUpcomingProd();
    renderAreaDistributionChart(); renderPie3DChart(); renderTrendChartProd(); renderSummaryProd();
    // + actualiza el chip "N desde hoy" junto al título del panel
}
```

- **`renderCalendarProd()`** (línea ~4912): un evento de FullCalendar por cada (producto × fecha programada). Color por área (`getAreaColor`). Si el material ya no está en la lista de pendientes actual, el evento lleva un ✓ verde superpuesto (`yaAutorizado`).
- **`renderUpcomingProd()`** (línea ~5021): lista lateral de las próximas fechas (desde "hoy" o la fecha que el usuario elija en el filtro "Desde"), con buscador por código/producto. Misma lógica de "✓ ya autorizado" que el calendario.
- **`renderAreaDistributionChart()` / `renderPie3DChart()` / `renderTrendChartProd()`** (línea ~5148 en adelante): barras horizontales por área, dona de distribución %, y línea de tendencia de los próximos 21 días. Los tres respetan `currentAreaFilter` y usan `getAreaColor()` para mantener el mismo color de área en toda la pestaña. Se redibujan también al alternar tema oscuro/claro (para tomar los colores correctos del tema nuevo).
- **`getAreaColor(area)`** (línea ~4143): busca coincidencia contra un mapa fijo de colores por prefijo de área (ordenado de la clave más larga a la más corta, para que "SOL HORM" no caiga en el color de "SOL"); si el área no está en el mapa, genera un color determinístico por hash sobre una paleta de respaldo — así un área nueva que aparezca en un Excel futuro siempre obtiene un color, y siempre el mismo.

---

## 10. Exportación y resumen

- **`exportPendientesToExcel()`** (línea ~8510): genera un `.xlsx` con estilo (usando `xlsx-js-style`) a partir de la lista de pendientes actual, con una hoja de detalle y una hoja resumen (`construirHojaResumenMacro`, con una matriz Actividad × Responsable).
- **`copyPendientesToClipboard()`** (línea ~8772): copia la tabla como texto tabulado (pegable directo en Excel).
- **`mostrarGraficoResponsableModal('produccion')`** (línea ~8707): gráfico de barras + dona de carga de trabajo pendiente por responsable, descargable como imagen (`generarImagenGraficoContraste`, vía `html2canvas`/Chart.js render a imagen).
- **`renderSummaryProd()`** (línea ~9564): arma el bloque de "Resumen" textual/gráfico que aparece al pie de la pestaña, reutilizando los mismos canvases que los gráficos principales.

---

## 11. Patrones que se repiten en todo el código (útiles al modificar)

Si vas a tocar Producción, estos son los patrones defensivos que ya están instaurados y conviene respetar:

1. **Capturar el contexto mutable antes de un `await`.** `processFileProd` guarda `plantaObjetivo = currentPlanta` al entrar; varias funciones de guardado comparan un "token" incremental (`__loadProdDataToken`) para descartar respuestas que llegaron tarde tras un cambio de planta a mitad de camino.
2. **`storeSet`/`storeGet` son el único canal de persistencia.** Nunca se llama a `fetch(SUPABASE_URL...)` ni a `dbStore` directamente fuera de esas dos funciones (y sus primas `storeRemove`, `storePendingMark`).
3. **Recalcular desde la fuente, no mutar el resultado en pantalla.** Cualquier cambio de estado (autorizar una etapa, cambiar de filtro de área, cargar un archivo) vuelve a llamar a `runValidacionMateriales()` (o `updateDashboardProd()` completo) en vez de parchear el DOM a mano — es más caro en CPU pero elimina toda una clase de bugs de estado desincronizado. Las excepciones puntuales (como `refiltrarTablaPendientes`, que re-renderiza sin recalcular la validación) están para los filtros de sólo-vista (texto, fechas, estado) que no cambian el resultado subyacente.
4. **Las claves compuestas son siempre `` `${material}::${etapaFija}` ``** (`responsableKey`), y las claves de "vista" del filtro de árbol siguen el prefijo `VISTA::<material>::<etapa>::<códigoAjeno>` para poder revertir selectivamente.
5. **Nunca cachear un fallo de red como si fuera un resultado válido.** Se documenta explícitamente en el código del árbol de materiales: cachear un 503 transitorio como "este material no tiene árbol" dejó a usuarios bloqueados sin reintento automático en una versión anterior.
6. **Área = nombre de hoja del Excel, textual.** No hay una lista fija de áreas en el código (a diferencia de las 5 etapas): `availableAreas` se recalcula en cada carga a partir de `wb.SheetNames`, así que agregar/quitar una hoja en el Excel de origen cambia automáticamente los filtros de área sin tocar código — pero también significa que un typo en el nombre de una hoja crea un área "fantasma" nueva en vez de fusionarse con la existente.

---

## 12. Dónde mirar según lo que quieras mejorar

| Quiero cambiar... | Mirar |
|---|---|
| Qué cuenta como "pendiente" / cómo se cruzan las 3 fuentes | `runValidacionMateriales()` — línea 7594 |
| Cómo se detectan fechas/hojas en el Excel de Producción | `processFileProd()` — línea 4486, y los `build*DateColumnMap*` alrededor de 4240–4420 |
| Las etapas del proceso o sus alias | `ETAPAS_FIJAS`, `ETAPA_ALIASES`, `mapEtapaAFija()` — línea ~6867 |
| Estatus disponibles / responsable por defecto | `ESTATUS_ETAPA_OPCIONES`, `ESTATUS_ETAPA_RESPONSABLE_DEFECTO` — línea ~5360 |
| Cómo se ve cada fila de la tabla principal | `renderTablaPendientes()` — línea 7823 |
| Colores/urgencia de la tabla | `urgenciaInicioHtml()` (7795), `getAreaColor()` (4143), clases CSS `.urg-*` / `.val-kpi*` en el `<style>` |
| Calendario / "Próximas a producir" / gráficos | `renderCalendarProd()`, `renderUpcomingProd()`, `render*ChartProd()` — línea ~4912–5260 |
| Filtro de árbol de materiales | `aplicarFiltroArbolPersistente()` (6222), `filtrarTodosPorArbol()` (6481) |
| Historial de cambios entre cargas | `registrarSnapshotProduccion()` / `renderHistorialTrazabilidadModal()` — línea ~3340–3460 |
| Exportar a Excel / copiar tabla | `exportPendientesToExcel()` (8510), `copyPendientesToClipboard()` (8772) |
| Persistencia / sync multi-dispositivo | `storeSet`/`storeGet` (3054), `iniciarSupabaseRealtime()`/`onRemoteKeyChanged()` (3161–3241) |
