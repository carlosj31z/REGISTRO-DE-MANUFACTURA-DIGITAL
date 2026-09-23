# RMD Pendientes de Autorización — Lógica de funcionamiento

Este documento explica **cómo funciona por dentro** `index.html` (una SPA de un solo archivo, sin build ni backend propio), con foco especial en la pestaña **Producción**, que es el corazón de la app: cruza el Programa de Producción con el árbol de producción de cada producto (listas de materiales de SAP) y los RMD de SAP para decirte, producto por producto y etapa por etapa, qué le falta autorización.

Está escrito para que puedas decidir **qué tocar** al mejorar Producción sin romper el resto. Cada sección indica el rango de líneas aproximado en `index.html` para ubicarte rápido.

---

## 1. Panorama general

- **Un solo archivo HTML** (~9.750 líneas) con `<style>` (CSS, variables de tema) + `<script>` (toda la lógica) + HTML de las 4 pestañas. No hay bundler, no hay módulos ES, no hay backend propio: todo corre en el navegador.
- **Librerías por CDN**: Tailwind (config inline, ver más abajo), FullCalendar (calendarios), Chart.js (gráficos), `xlsx-js-style` (leer/escribir Excel), Day.js (fechas), SweetAlert2 (todos los diálogos/modales), GSAP (animaciones de transición), html2canvas (exportar gráficos como imagen), localForage (IndexedDB), Supabase JS SDK (persistencia + realtime), y un script externo `arbol-motor.js` (motor de árbol de materiales BOM de SAP, con el que se calcula el árbol de producción de cada producto).
- **4 pestañas** controladas por `currentTab` / `switchTab()` (línea ~3641): `forecast`, `produccion`, `rmd` (llamada en la UI "OP sin RMD"), `seguimiento` (una app secundaria completa, embebida como HTML en base64 en `SEGUIMIENTO_RMD_HTML_B64` y cargada en un `<iframe>` la primera vez que se abre esa pestaña — está fuera del alcance de este documento).
- **Persistencia**: cada pieza de estado importante se guarda con `storeSet(key, value)` / se lee con `storeGet(key)` (línea ~3038). Este par de funciones son el único punto de entrada a la persistencia en toda la app — nunca se llama a Supabase o a IndexedDB directamente desde el resto del código.
- **Multi-dispositivo en vivo**: Supabase Realtime (línea ~3145) escucha cambios en la tabla KV y refresca la parte de pantalla afectada en cualquier otra pestaña/dispositivo abierto, sin recargar la página.
- **Trazabilidad**: antes de cargar o borrar cualquier archivo, se pide un DNI (`pedirDNI`, línea ~3248) que se valida contra un directorio fijo en el código (`DNI_DIRECTORIO`) y queda registrado en un historial (`registrarHistorial`). La **sincronización con SAP** (botón "Enviar a Status RMD" del portal, script ≥ v1.19) no pide DNI: queda registrada con el usuario con el que se inició sesión en el portal (sección 4.9). Lo que la app hace sola (p. ej. autorizaciones manuales que caducan) queda como "Status RMD (automático)".

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

La **Base de Datos** (material → Código Agrupador) y el Código Agrupador **ya no existen** en la app: se quitaron su botón, su carga, el antiguo "filtrado por árbol" por agrupador y el autocompletado desde el árbol. Sus claves guardadas (`val_database_materials`, `val_agrupador_etapas`, `val_rmd_autorizados_raw`, `val_rmd_autorizados_etapas_por_agrupador`, `val_descartados_por_arbol*`) ya no se leen ni se escriben (no se borraron).

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

let manualAutorizados = new Set();   // claves "material::ETAPA_FIJA" marcadas ✓ a mano (val_manual_autorizados)
let manualAutorizadosMeta = new Map(); // clave -> { f: fecha, c: huella de lo pendiente en SAP } (val_manual_autorizados_meta)
let estatusEtapa = new Map();        // "material::ETAPA_FIJA" -> 'PENDIENTE-PRO' | 'POR INGRESAR' | ...
let responsablesEtapa = new Map();   // "material::ETAPA_FIJA" -> 'PRO' | 'DOC' | 'ASC' | 'IDE'
let ultimosCambiosSap = null;        // qué cambió con la última sincronización (val_cambios_sap)
const filtrosEtapaProd = { etapa, sap, edad }; // filtros por etapa de la tabla (solo vista)

let ultimoResultadoValidacion = { revisados, autorizados, pendientes:[...], autorizadosManual:[...], rmdPendientes };
```

Todas estas colecciones (salvo `productionData`, que vive bajo `prod_data_<planta>`) se guardan bajo claves `val_*` en Supabase/IndexedDB y se recargan al arrancar con `loadValidacionData()` (línea ~6946).

---

## 3. Carga y parseo del Programa de Producción (la parte más delicada)

Esta es la lógica más frágil de toda la app, porque **el formato del Excel de origen no es estable**: cambia entre Planta ATE y Planta LIMA, y dentro de la misma planta puede haber hojas con formato antiguo y nuevo mezcladas. Vale la pena entenderla bien antes de tocar nada aquí.

### 3.1 Flujo

1. El usuario sube un `.xlsx` → `handleFileProd(e)` (línea ~4441) pide el DNI (`autorizarYRegistrar`) y, si se aprueba, llama a `processFileProd(file)` (línea ~4504).
2. `processFileProd` **captura `currentPlanta` en una variable local (`plantaObjetivo`) antes de leer el archivo** — como la lectura es asíncrona (`FileReader`), si el usuario cambia de planta mientras se procesa, el archivo se sigue tratando como de la planta que estaba activa al iniciar la carga. Este patrón ("capturar el contexto antes de un `await`") se repite en varias partes de la app — es la defensa estándar contra condiciones de carrera con el usuario interactuando durante una operación async.
3. Se lee el workbook completo con `XLSX.read`, y se recorre **hoja por hoja** (`wb.SheetNames.forEach`). Cada hoja = un área de producción (SOL, ACO, INY, COS, CAP BLAN, SOL HORM, SOL COLOR, SEM, MEN, REA, PEF...).
4. Por cada hoja se extrae una lista de productos con sus fechas programadas, y todo se acumula en un `Map` (`pmap`) con clave `` `${codigo}_${areaHoja}` `` — es decir, **el mismo código de material en dos áreas distintas cuenta como dos entradas separadas** (porque puede tener etapas pendientes distintas en cada área).
5. Al final se guarda con `storeSet('prod_data_<planta>', { data, areas })` y, si ya había una versión anterior de esa planta, se genera un snapshot de trazabilidad (sección 6).

### 3.2 Por qué el parseo de fechas es tan complejo

El Programa de Producción no trae "una fecha por celda" de forma simple. Hay dos formatos según la planta:

**Planta ATE (`planta1Format = true`)** — `buildDateColumnMapPlanta1()` (línea ~4244):
- Una fila con etiquetas de semana tipo `S37`, `S38`... (formato corto).
- Debajo, una fila de encabezados de columna (día de la semana implícito por posición: offset 0 = lunes, offset 6 = domingo).
- La fecha real de cada columna se **reconstruye matemáticamente**: `isoWeekMonday(37) + offset días`, no se lee un valor de fecha literal de la celda.

**Planta LIMA (`planta1Format = false`)** — `buildDateColumnMap()` (línea ~4400), con dos variantes que se auto-detectan:
- **Formato nuevo**: las fechas vienen como objetos `Date` reales, directamente en la fila de "Código" o en la siguiente.
- **Formato antiguo**: la fila de fechas trae **números de día sueltos** (7, 8, 9...) bajo encabezados de día de la semana (L, M, M, J, V, S, D), y hay que reconstruir la fecha completa combinando esos números con el bloque de semana (`SEM31`, etc.) más cercano arriba.
- La detección de cuál formato es se hace **contando** cuántas celdas de la fila de "Código" vs. la fila siguiente parecen fechas reales (`scoreDirectDates`), y se usa la que tenga más.

**El "mapa global de semanas" (`buildGlobalWeekMondayMap()`, línea ~4274)** es una pieza aparte: como una misma etiqueta de semana (ej. `S37`) puede aparecer en varias hojas del mismo libro, y no todas tienen una fecha directa ancla, se hace **una pasada completa por todo el workbook primero** para capturar cualquier fecha real y asociarla a su número de semana, y **solo después** (segunda pasada) se rellenan por cálculo ISO las semanas que sigan sin fecha. El comentario en el código documenta un bug real de versiones anteriores donde el orden de las hojas hacía que un respaldo calculado (equivocado) se escribiera antes de que apareciera la fecha real correcta en otra hoja — por eso ahora está separado en dos pasadas explícitas.

### 3.3 Filtrado de filas que no son "producción real"

- `containsExcludedTermPlanta1` / `containsExcludedTermPlanta2` (línea ~4152): celdas cuyo contenido es un término como `LIMP`, `VAL`, `SETUP`, `MTTO` (ATE) o `MMTO`, `MTO`, `MAN` (LIMA) se ignoran — no cuentan como fecha programada aunque estén dentro del rango de columnas de fecha.
- Ciertas hojas completas se excluyen según la planta: `REA` se excluye solo en Planta LIMA; `SOP BEB`, `SOP P1`, `SOP P2` se excluyen solo en Planta ATE.
- El código de material debe matchear `^[56]\d{9}$` (10 dígitos, empieza con 5 o 6) — cualquier otra cosa en la columna "Código" se descarta.
- `filtrarFechasFuturas()` → `isDentroDeVentanaProduccion()` — solo se conservan fechas desde el **lunes de la semana actual**; lo programado solo en semanas anteriores se descarta como si ya no aplicara.
- **Semanas sin año** (`buildDateColumnMap`): algunas hojas de Planta LIMA (MENT, SEM, COS) traen el historial de todo el año, desde "SEMANA N° 45" del año anterior hasta la semana actual, con "SEMANA N° 53/54/55" en el cambio de año y números de día sueltos. El número de semana no dice el año y un bloque viejo caía en el año actual o el siguiente (caso real: el bloque "N° 53" de fin de 2025 terminaba en 01/01/2027 y MENTHOLATUM 6000003525 aparecía programado a futuro). Ahora el número de día del encabezado desambigua: si no coincide con la fecha reconstruida y sí con la misma semana un año antes (o después), se usa esa. Comprobado contra una lectura independiente en Python de ambos programas: mismos productos por hoja.

### 3.4 Planta ATE, Planta LIMA y Consolidado

`switchPlanta(planta)` (línea ~4837) cambia `currentPlanta` y llama a `loadProdData()`:

- `'planta1'` / `'planta2'` → lee directamente `prod_data_planta1` / `prod_data_planta2`.
- `'consolidado'` → `loadProdDataConsolidado()` (línea ~4792): trae **ambas** claves en paralelo y las fusiona en un solo array, etiquetando cada producto con `planta: 'planta1' | 'planta2'` (usado solo para mostrar de dónde viene, no afecta el cruce por código).
- El botón "Consolidado" está deshabilitado hasta que **ambas** plantas tengan datos (`updateConsolidadoBtnState()`, línea ~4823, se llama después de cada carga/borrado). Si el usuario está en consolidado y una planta se queda sin datos, la app lo saca automáticamente de vuelta a Planta LIMA.

### 3.5 Archivo original y trazabilidad de carga

Cada carga guarda también el Excel original en base64 (`prod_archivo_original_<planta>`) para poder re-descargarlo tal cual se subió (botón "✓ Cargado"), junto a la fecha/hora de última carga.

---

## 4. Validación por árbol de producción: `runValidacionMateriales()`

Solo necesita el **Programa de Producción** y los **RMD de SAP**; si falta alguno deja la tabla vacía con un mensaje que dice cuál. La primera vez del día espera a que cargue el motor de árboles ("Cargando el árbol de materiales de SAP…", `esperarMotorArboles`) y, al terminar, recalcula las DOS pestañas (antes solo la visible: la otra se quedaba con el aviso de carga al cambiar de pestaña); después cada validación tarda ~50 ms. Forecast (`runValidacionForecast`) usa exactamente la misma lógica.

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

### 4.5 Paso 4 — Restar lo autorizado manualmente (autorizaciones que caducan solas)

Las etapas pendientes se filtran contra `manualAutorizados` (botón ✓ de una etapa). Si no queda ninguna, el producto pasa a `autorizadosManual`; si quedan algunas, sigue pendiente mostrando las que faltan más las autorizadas a mano (tachadas, con su estado real en SAP, "a mano · DD/MM" y el botón Revertir).

Una autorización manual **caduca sola, sin DNI**, cuando SAP **resuelve** la etapa (la autoriza) o **registra una versión nueva** de su código (o aparece pendiente un código que no lo estaba): así una autorización vieja nunca tapa un RMD nuevo. Al marcar ✓ se guarda, junto a la clave de siempre (`val_manual_autorizados`), su fecha y la **huella** de lo pendiente en SAP en ese momento: código, versión y número de RMD de cada código pendiente de la etapa (`val_manual_autorizados_meta` / `val_manual_autorizados_forecast_meta`; `metaNuevaManual`). `aplicarCaducidadManuales()` (línea ~6203) revisa todas las de Producción y Forecast en cada validación (`revisarAutorizacionesManuales`) y con cada sincronización, **solo con la evaluación exacta** (datos de SAP con recetas y árbol cargado); `motivoCaducidadManual` decide:
- ningún código de la etapa pendiente → caduca ("SAP ya la resolvió");
- un código pendiente con otra versión u otro RMD que el de la huella → caduca ("SAP registró una versión nueva…"); una solicitud que pasa a RMD con la misma versión no cuenta como versión nueva;
- mismo RMD y versión, aunque cambie de estado → se mantiene.

Las autorizaciones anteriores a esta versión (sin huella) reciben la suya la primera vez que se revisan; las de etapas que ya no están en el árbol de su producto reciben una huella vacía (si esa etapa llega a aparecer pendiente, caducan). Las claves sin etapa de una versión muy antigua (solo el código, 21 hoy) no tienen efecto y no se tocan. Lo que caduca queda en el historial como "Status RMD (automático)", en **Cambios de SAP** (sección 4.10) y, si pasó fuera de una sincronización, con un aviso discreto abajo a la izquierda (`avisoDiscreto`). Con los datos del equipo del 23/09/2026: de 260 autorizaciones de Producción, 163 caducan la primera vez (SAP ya autorizó esas etapas: hoy no tapan nada, los KPI no cambian: 140 / 47 / 72).

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

- **Chip** bajo cada etapa pendiente (`chipSapEtapa`): estado real en SAP (`Ingresado v4`, `Suspendido v2`, `Solicitado v9`, `Sin RMD`); con varias rutas, `+N`. El tooltip lista cada código con su RMD y su fecha de registro.
- **Antigüedad del pendiente** junto al chip (`edadPendienteHtml`): días desde la Fecha Registro en SAP del RMD que decide la etapa (gris hasta 30 d, ámbar de 31 a 90, rojo desde 91). También en la ventana de la etapa ("hace N días") y en la hoja Detalle SAP del Excel ("Antigüedad (días)").
- **Filtros por etapa** en la barra de la tabla (Producción y Forecast): **Etapa**, **Estado SAP** (Ingresado, Suspendido, Solicitado, Sin RMD, Otro) y **Antigüedad** (hasta 7 días, más de 7, más de 30, más de 90). Se aplican a cada etapa de la fila (pendiente o autorizada a mano): la fila se ve si alguna etapa cumple y solo se muestran las que cumplen; el contador dice "N de M materiales · K etapas". No cambian los KPI (`aplicarFiltrosEtapa`, `candidatoPasaFiltros`).
- **Clic en la etapa** (`mostrarDetalleEtapa` → `mostrarEtapaPrecisa`): solo el código (o los códigos, uno por ruta vigente) de esa etapa y el RMD que decide su estado — número de RMD o de solicitud, versión, estado, fecha de registro y **Observación** (`filaDetalleDeEntrada`) —, la explicación de por qué está pendiente, las rutas del árbol con la etapa resaltada y, plegado, el historial de versiones de ese mismo código.
- **Exportar Excel** (Producción y Forecast): las columnas de etapa van en orden de producción y la hoja **Detalle SAP** tiene una fila por código pendiente con su ruta, RMD, versión, estado, registro y observación (`hojaDetalleSap`).
- **Semáforo de los datos de SAP** junto a "Exportado RMD" (Producción y Forecast): "SAP 23/09 · hoy" en **verde hasta 7 días** sin sincronizar, **ámbar de 8 a 14** y **rojo desde 15** (fecha más reciente entre la sincronización y el último Exportado; `frescuraDatosSap`). Los límites se ajustan en `SEMAFORO_SAP_AMBAR_DESDE_DIAS` / `SEMAFORO_SAP_ROJO_DESDE_DIAS`. Se recalcula cada 30 min y al volver a la pestaña; el tooltip trae las fechas.

### 4.8 El maestro de RMD: SAP o Exportado

- **Con recetas** (botón "Enviar a Status RMD", o un Excel con las columnas `Linaje`, `Código Receta`…): reemplaza el maestro completo (`datosPrecisosDesdeFilas`). Se guarda en `val_rmd_preciso` (≈2 MB): una fila por RMD `[rmd, linaje, versión, estado, etapa, agrupador, código por defecto, descripción, [[material, versión de fabricación]…], fechaRegistroMs, códigoSolicitud]`.
- **Exportado clásico** (sin recetas): ya no hace volver a ninguna lógica por agrupador. Sus estados se **suman** al maestro existente (`fusionarDatosPrecisos`): se conservan las recetas de la última sincronización, un estado solo **avanza** (Solicitado → Solicitud Aprobada/Rechazada → Ingresado → Autorizado → Suspendido/Cancelado; un Exportado más viejo no retrocede nada) y los RMD nuevos cuentan por su Código por Defecto hasta la próxima sincronización. Si no había maestro, se usa ese Exportado solo y la fuente dice "sin recetas".
- Al abrir la página, si solo hay datos de un Exportado clásico guardado (de antes de esta versión), la validación por árbol funciona igual con ellos (`datosPrecisosDesdeDetalle`).

**Resultado medido** con los programas ATE del 17/09/2026 y LIMA de las semanas 38–40 y el maestro de SAP del 23/09/2026 (autorizados / pendientes / etapas pendientes): ATE, 65 productos, 22 / 43 / 69 con la antigua lógica por agrupador → **51 / 14 / 21**; LIMA, 98 productos, 68 / 30 / 51 → **65 / 33 / 51**. Los 163 productos tienen árbol; en LIMA 4 etapas tienen dos rutas vigentes. Verificación independiente (misma regla recalculada en Python desde el Excel crudo): 0 diferencias en 513 etapas y 517 códigos.

### 4.9 Enlace directo con el portal SAP (sin archivo)

El script de Tampermonkey del portal (`rmd-ui-mejoras.user.js` ≥ v1.17; v1.18 envía además la hora de registro; repo AUTOMATIZACION-DE-RMD) añade junto a "Exportar" el botón **Enviar a Status RMD**: abre esta página en otra pestaña, lee el maestro completo con sus recetas usando la sesión ya iniciada del portal (el mismo servicio OData que usa su propio botón Exportar) y lo pasa con `postMessage`. Protocolo: el portal envía `STATUS_RMD_PING` hasta que esta página responde `STATUS_RMD_LISTO` (solo cuando terminó de cargar), luego `RMD_SAP_MAESTRO` (`{ v:1, generado, columnas, filas }`) y esta página contesta `STATUS_RMD_RECIBIDO` (`{ ok, resumen | motivo }`). Desde el script **v1.19** el mensaje trae también `usuarioSap` (`{ id, nombre, email }`, leído del propio launchpad con `sap.ushell.Container.getUser()`; nunca una contraseña): la sincronización queda registrada en el historial con ese usuario ("NOMBRE (usuario SAP: correo)", más su identificador) **en un solo clic, sin DNI** (`identidadDeUsuarioSap`). Con un script anterior, o si el usuario no llega bien, se pide el DNI como antes. Se procesa con el mismo `procesarFilasRmd` que un Excel subido (`recibirMaestroDesdeSap`, línea ~6648) y la respuesta al portal incluye qué cambió. Tiempo medido: ≈8 s para 12 732 RMD (prueba real del 23/09/2026, sin escribir nada).

**Por qué no un GET directo desde esta página a SAP:** la API del portal exige la sesión SSO de la persona (cookies del dominio de SAP), el navegador bloquea las llamadas entre dominios (CORS) y la alternativa —guardar un usuario técnico o credenciales en este repositorio público— sería un riesgo de seguridad. El enlace por pestañas reutiliza la sesión que la persona ya tiene abierta y no toca credenciales.

**Seguridad de mensajes** (listener de `message`): `STATUS_RMD_PING` y `RMD_SAP_MAESTRO` solo se aceptan desde el origen exacto del portal (`PORTAL_SAP_ORIGIN`) y cuando la app ya está lista; los mensajes `RMD_SEGUIMIENTO_*` solo desde el iframe de Seguimiento RMD (`event.source`). Antes cualquier página que abriera esta en una ventana podía enviarle mensajes.

**Tiempo real:** si otro dispositivo guarda datos de validación nuevos (`val_rmd_preciso`, `val_rmd_autorizados_detalle`, `val_flags`), esta página los recarga (con 1,5 s de espera para agrupar las escrituras) y vuelve a validar. Las autorizaciones manuales y su huella se recargan juntas (0,8 s de espera) y `val_cambios_sap` actualiza el botón "Cambios de SAP".

### 4.10 Qué cambió desde la última sincronización

Con cada carga de RMD (sincronización con SAP o Exportado), `registrarCambiosSap()` (línea ~6372) compara, para los productos de los programas de ATE y LIMA y del Forecast, cada etapa de su árbol con los datos anteriores y con los nuevos (`evaluarMaterialPreciso(material, P)` acepta el índice a usar): **etapas que SAP autorizó**, **nuevas etapas pendientes** y **etapas pendientes con otro RMD o estado**, más las **autorizaciones manuales que caducaron**. Se guarda la última comparación en `val_cambios_sap` (con fecha, origen y quién sincronizó) y se ve:
- en el aviso "¡Listo!" (resumen y botón "Ver qué cambió") y en el aviso del portal;
- con el botón **Cambios de SAP** (Producción y Forecast; el número es la cantidad de cambios), que abre la lista por secciones y permite **Descargar Excel** (`mostrarCambiosSap`, `descargarCambiosSapExcel`).
Si antes no había datos, o no se pudo cargar el árbol, lo dice en vez de comparar. Si se pasa de un Exportado sin recetas a datos con recetas (o al revés) avisa de que parte de los cambios se deben al cambio de método.

---

## 5. Las "5 etapas fijas" y el mapeo de estatus

Todo el sistema de etapas gira en torno a una lista fija, en el **orden de producción** (en los 4.528 árboles de SAP revisados, Inspección va siempre DESPUÉS de Envase: inyectables Fabricación › Envase › Inspección › Acondicionado). Es también el orden de las etapas en la tabla y de las columnas del Excel:

```js
const ETAPAS_FIJAS = ['FABRICACION', 'RECUBRIMIENTO', 'ENVASE', 'INSPECCION', 'ACONDICIONADO'];
```

Los Excel de origen escriben la etapa con texto libre y variable (ej. "Acondicionado Final", "ENV."), así que `mapEtapaAFija()` (línea ~5676) usa un diccionario de alias (`ETAPA_ALIASES`) más coincidencia parcial para normalizar cualquier variante al valor fijo correspondiente. Si el texto menciona **más de una** etapa fija a la vez (dato corrupto de origen), se trata como no reconocible en vez de adivinar.

### 5.1 Estatus de cada etapa pendiente y responsable automático

En la tabla, cada etapa pendiente de un producto tiene un `<select>` de **Estatus** (línea ~5357):

```js
const ESTATUS_ETAPA_OPCIONES = ['PENDIENTE-PRO', 'POR INGRESAR', 'FLUJO SAP', 'PEND RMD OFICIAL', 'PEND CC'];
const ESTATUS_ETAPA_RESPONSABLE_DEFECTO = {
  'PENDIENTE-PRO': 'PRO', 'POR INGRESAR': 'DOC', 'FLUJO SAP': 'PRO', 'PEND RMD OFICIAL': 'DOC'
  // 'PEND CC' NO tiene default: es responsabilidad compartida ASC/PRO, el usuario debe elegir a mano
};
```

`window.setEstatusEtapa(material, etapaFija, valor)` (línea ~5379) es el único punto que escribe en `estatusEtapa` y `responsablesEtapa` a la vez: el responsable **ya no es editable directamente** (dejó de ser un `<select>` libre), se deriva siempre del estatus elegido, salvo en `PEND CC` donde queda un segundo `<select>` (ASC/PRO) obligatorio antes de poder autorizar esa etapa (`toggleManualAutorizadoEtapa` lo bloquea explícitamente si falta elegir).

---

## 6. Historial de trazabilidad del Programa de Producción

Cada vez que se carga un Excel de Producción y ya existía una versión anterior guardada de esa misma planta, `registrarSnapshotProduccion()` (línea ~3344) compara ambas versiones material-por-área (`claveMaterial = codigo::area`) y clasifica cada diferencia en:

- **Desaparecidos**: tenía fecha(s) antes, ya no aparece.
- **Reprogramados**: sigue existiendo pero cambió al menos una fecha.
- **Nuevos**: no existía antes.

Se guardan hasta 30 snapshots por planta (`prod_historial_planta1` / `prod_historial_planta2`). El botón "Historial" del calendario de Producción abre un modal (`mostrarHistorialTrazabilidadProduccion`) con pestañas Planta ATE / Planta LIMA / Consolidado (el consolidado simplemente intercala los snapshots de ambas por fecha, no tiene almacenamiento propio) y un selector para navegar entre snapshots.

---

## 7. Árbol de materiales (BOM de SAP)

El árbol es la **base de la validación** (sección 4.2). Esta sección describe de dónde sale.

### 7.1 Qué es "el árbol" y de dónde sale

Un producto real de SAP se descompone en los nodos de su lista de materiales (BOM): Fabricación (semielaborado, a veces compartido entre presentaciones), Recubrimiento, Envase, Inspección y Acondicionado, cada uno con su propio código. Se calcula con el **motor local**: se descargan 4 tablas (`mm_bom`, `mm_bom_componentes`, `mm_vfab`, `mm_materiales`) desde el proyecto de Supabase de "Listas de materiales" (**distinto** al de la app), se guardan hasta 12 h en IndexedDB y se corre aquí mismo el motor de cálculo de esa página (`arbol-motor.js`, cargado como `<script>` en el `<head>`; `obtenerMotorArbolLocal`, línea ~5559). `precalentarMotorArbolLocal()` (línea ~5611) dispara la descarga en segundo plano justo después de la carga inicial. La API remota (`/api/arbol` en Vercel) y el antiguo "filtrado por árbol" por Código Agrupador (descartes por vista, `filtrarTodosPorArbol`…) **ya no existen**: con el árbol como base de la validación no hacían falta. La caché del navegador que usaban (`arbolMaterialesCacheV2`) se libera al abrir la página.

---

## 8. Render de la tabla "RMD Pendientes de Autorización"

`renderTablaPendientes(filas)` (línea ~7354) recibe la lista combinada de pendientes + autorizados manuales (`ultimoResultadoValidacion`) y:

- Guarda la lista completa en `window.__ultimasFilasValidacion` (para que los filtros de texto/estado/fecha puedan re-renderizar sin recalcular la validación completa — ver `refiltrarTablaPendientes()`).
- Aplica en cascada: filtro de estado (`validacionFiltroEstado`: todos/pendientes/autorizados), búsqueda de texto (`validacionBusqueda`, con debounce de 150ms en el input), filtro de fechas puntuales (`validacionFiltroFechas`, un popup tipo Excel sobre la columna "Inicio de Producción") y los filtros por etapa (Etapa, Estado SAP, Antigüedad; sección 4.7).
- La celda de etapas la arma `htmlEtapasDeFila(p, origen)` (línea ~7307), la misma para Producción y Forecast: un bloque `.etapa-fila-grid` por etapa pendiente (chip de SAP + antigüedad, `<select>` de Estatus, responsable derivado, botón ✓) y otro por cada etapa autorizada a mano (tachada, con su chip de SAP, "a mano · DD/MM" y "Revertir"). En una fila "Autorizado manual" cada etapa se muestra una sola vez (antes salía repetida: como pendiente tachada y como autorizada).
- Calcula `urgenciaInicioHtml()` (línea ~7193): un chip visual según cuántos días faltan hasta la fecha de inicio de producción (`urg-vencido` si ya pasó, `urg-hoy`, `urg-pronto` si son 1–3 días, `urg-normal` en otro caso).
- Actualiza los contadores de los pills de filtro (`actualizarContadoresPendientes`) y el contador del panel (`actualizarContadorPanelRmd`).

---

## 9. Calendario, "Próximas a Producir" y gráficos de Producción

Todos se recalculan juntos desde `updateDashboardProd()` (línea ~4864), que es el punto de entrada que se llama tras cualquier cambio relevante (carga de archivo, cambio de filtro de área, cambio de planta):

```js
function updateDashboardProd() {
    runValidacionMateriales();
    renderFiltersProd(); renderKPIsProd(); renderCalendarProd(); renderUpcomingProd();
    renderAreaDistributionChart(); renderPie3DChart(); renderTrendChartProd(); renderSummaryProd();
    // + actualiza el chip "N desde hoy" junto al título del panel
}
```

- **`renderCalendarProd()`** (línea ~4930): un evento de FullCalendar por cada (producto × fecha programada). Color por área (`getAreaColor`). Si el material ya no está en la lista de pendientes actual, el evento lleva un ✓ verde superpuesto (`yaAutorizado`).
- **`renderUpcomingProd()`** (línea ~5039): lista lateral de las próximas fechas (desde "hoy" o la fecha que el usuario elija en el filtro "Desde"), con buscador por código/producto. Misma lógica de "✓ ya autorizado" que el calendario.
- **`renderAreaDistributionChart()` / `renderPie3DChart()` / `renderTrendChartProd()`** (línea ~5148 en adelante): barras horizontales por área, dona de distribución %, y línea de tendencia de los próximos 21 días. Los tres respetan `currentAreaFilter` y usan `getAreaColor()` para mantener el mismo color de área en toda la pestaña. Se redibujan también al alternar tema oscuro/claro (para tomar los colores correctos del tema nuevo).
- **`getAreaColor(area)`** (línea ~4147): busca coincidencia contra un mapa fijo de colores por prefijo de área (ordenado de la clave más larga a la más corta, para que "SOL HORM" no caiga en el color de "SOL"); si el área no está en el mapa, genera un color determinístico por hash sobre una paleta de respaldo — así un área nueva que aparezca en un Excel futuro siempre obtiene un color, y siempre el mismo.

---

## 10. Exportación y resumen

- **`exportPendientesToExcel()`** (línea ~7992): genera un `.xlsx` con estilo (usando `xlsx-js-style`) a partir de la lista de pendientes actual, con una hoja de detalle y una hoja resumen (`construirHojaResumenMacro`, con una matriz Actividad × Responsable).
- **`copyPendientesToClipboard()`** (línea ~8256): copia la tabla como texto tabulado (pegable directo en Excel).
- **`mostrarGraficoResponsableModal('produccion')`** (línea ~8191): gráfico de barras + dona de carga de trabajo pendiente por responsable, descargable como imagen (`generarImagenGraficoContraste`, vía `html2canvas`/Chart.js render a imagen).
- **`renderSummaryProd()`** (línea ~8993): arma el bloque de "Resumen" textual/gráfico que aparece al pie de la pestaña, reutilizando los mismos canvases que los gráficos principales.

---

## 11. Patrones que se repiten en todo el código (útiles al modificar)

Si vas a tocar Producción, estos son los patrones defensivos que ya están instaurados y conviene respetar:

1. **Capturar el contexto mutable antes de un `await`.** `processFileProd` guarda `plantaObjetivo = currentPlanta` al entrar; varias funciones de guardado comparan un "token" incremental (`__loadProdDataToken`) para descartar respuestas que llegaron tarde tras un cambio de planta a mitad de camino.
2. **`storeSet`/`storeGet` son el único canal de persistencia.** Nunca se llama a `fetch(SUPABASE_URL...)` ni a `dbStore` directamente fuera de esas dos funciones (y sus primas `storeRemove`, `storePendingMark`).
3. **Recalcular desde la fuente, no mutar el resultado en pantalla.** Cualquier cambio de estado (autorizar una etapa, cambiar de filtro de área, cargar un archivo) vuelve a llamar a `runValidacionMateriales()` (o `updateDashboardProd()` completo) en vez de parchear el DOM a mano — es más caro en CPU pero elimina toda una clase de bugs de estado desincronizado. Las excepciones puntuales (como `refiltrarTablaPendientes`, que re-renderiza sin recalcular la validación) están para los filtros de sólo-vista (texto, fechas, estado) que no cambian el resultado subyacente.
4. **Las claves compuestas son siempre `` `${material}::${etapaFija}` ``** (`responsableKey`): Estatus, responsable, autorización manual y su huella usan la misma.
5. **Nunca cachear un fallo de red como si fuera un resultado válido.** Si el motor de árboles no carga, queda "no-disponible" con un aviso y un botón Reintentar (`avisoMotorArboles`), en vez de guardar "sin árbol".
6. **Área = nombre de hoja del Excel, textual.** No hay una lista fija de áreas en el código (a diferencia de las 5 etapas): `availableAreas` se recalcula en cada carga a partir de `wb.SheetNames`, así que agregar/quitar una hoja en el Excel de origen cambia automáticamente los filtros de área sin tocar código — pero también significa que un typo en el nombre de una hoja crea un área "fantasma" nueva en vez de fusionarse con la existente.

---

## 12. Dónde mirar según lo que quieras mejorar

| Quiero cambiar... | Mirar |
|---|---|
| Qué cuenta como "pendiente" / cómo se cruzan las fuentes | `runValidacionMateriales()` — línea 7005; `evaluarEtapaArbol()` (6111) y `calcularArbolProduccion()` (6060) |
| Cómo se detectan fechas/hojas en el Excel de Producción | `processFileProd()` — línea 4504, y los `build*DateColumnMap*` alrededor de 4244–4440 |
| Las etapas del proceso o sus alias | `ETAPAS_FIJAS`, `ETAPA_ALIASES`, `mapEtapaAFija()` — línea ~5660 |
| Estatus disponibles / responsable por defecto | `ESTATUS_ETAPA_OPCIONES`, `ESTATUS_ETAPA_RESPONSABLE_DEFECTO` — línea ~5357 |
| Cómo se ve cada fila de la tabla principal | `renderTablaPendientes()` (7354) y `htmlEtapasDeFila()` (7307) |
| Colores/urgencia de la tabla | `urgenciaInicioHtml()` (7193), `edadPendienteHtml()`, `getAreaColor()` (4147), clases CSS `.urg-*` / `.edad-pend*` / `.val-kpi*` en el `<style>` |
| Calendario / "Próximas a producir" / gráficos | `renderCalendarProd()`, `renderUpcomingProd()`, `render*ChartProd()` — línea ~4930–5280 |
| Cuándo caduca una autorización manual | `motivoCaducidadManual()` y `aplicarCaducidadManuales()` — línea ~6203 |
| Qué cambió con una sincronización | `registrarCambiosSap()` (6372), `compararEvaluaciones()`, `mostrarCambiosSap()` (6410) |
| Semáforo de los datos de SAP | `frescuraDatosSap()` (6468) y las constantes `SEMAFORO_SAP_*` |
| Enlace con el portal SAP / usuario de SAP | `recibirMaestroDesdeSap()` (6648), `identidadDeUsuarioSap()` |
| Historial de cambios entre cargas | `registrarSnapshotProduccion()` / `renderHistorialTrazabilidadModal()` — línea ~3344–3460 |
| Exportar a Excel / copiar tabla | `exportPendientesToExcel()` (7992), `copyPendientesToClipboard()` (8256) |
| Persistencia / sync multi-dispositivo | `storeSet`/`storeGet` (3038), `iniciarSupabaseRealtime()`/`onRemoteKeyChanged()` (3145–3240) |
