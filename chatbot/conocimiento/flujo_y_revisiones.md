# Flujo de trabajo y revisiones posteriores al ingreso

## Paso 0 — ¿Hay un RMD de referencia?
Antes de tocar nada se pregunta al usuario si existe un RMD de referencia y se le pide su **"Codigo RMD"**
(por ejemplo `2202608443`). Si lo hay, se lee en solo lectura, se guarda en `data/snapshots/ref_<codigo>.json`
y se compara contra el RMD a modificar. Se puede indicar con `--referencia <codigo>` o con `rmd_referencia:`
en la especificación YAML; si no se da, `cambios aplicar` lo pregunta.

## Después del ingreso — revisiones (se preguntan al usuario)
Al terminar (`verificado`), el programa pregunta si se quieren aplicar estas revisiones. Se hacen con el asistente,
leyendo SharePoint en solo lectura:

| Revisión | Fuente (SharePoint, `DOCUMENTACION TECNICA/04.-RMD/...`) | Qué se comprueba |
|---|---|---|
| Tren de equipos | `2.- LISTADOS AMBAS PLANTAS/LISTADOS PL2/TREN DE EQUIPOS PL2.xlsx` (hojas ACONDICIONADO, SOL, COSMETICOS, PEF) | Los equipos del RMD coinciden con la línea/sala y la balanza asociada de la etapa. |
| Controles de cambio pendientes | `2.- LISTADOS AMBAS PLANTAS/1.-CC-NC-DES Para actualizar RMD.xlsx`, hoja **PLANTA 2** | Filas con ESTATUS vacío/PEND/PENDIENTE/EN PROCESO cuya área y etapa aplican al RMD (o cuyo correo lo menciona). |
| Utensilios y accesorios | `UTENSILIOS/PLANTA 2/` (un Excel por área: SOL, ACO, CBL, COS, IHS, INH, MEN, PEF, SEH, SEM, SHO, P2 CBL…) | Los utensilios de cada sección del RMD coinciden con la lista vigente del área (la más reciente por versión/fecha). |

Nota: en la hoja PLANTA 2 la columna APLICA puede ser SI / NO / SI-BORRADOR; los ítems "Creación de receta" o
"producto nuevo" suelen ser NO para RMD existentes. Se revisa caso por caso; no se aplican cambios sin confirmar.

## Antes del ingreso — sugerencia de la matriz de priorizados
Libro `2.- LISTADOS AMBAS PLANTAS/Matriz RMD priorizados v1 KZ 2026.xlsx`, hoja **PLANTA 2 DOC TEC** (solo Planta 2).
El analista anota ahí, antes de iniciar el ingreso, los RMD pendientes: columna **G** (ingreso) y **K** (autorización)
con "PENDIENTE", y en la columna **O** ("observación adicional") el motivo. No hay código de RMD: se busca por
**nombre de producto y etapa**. Es solo una sugerencia (no bloquea el ingreso).

El conector de SharePoint no alcanza esa hoja (corta el libro antes), así que se exporta la hoja a `.xlsx`/`.csv`
y se usa: `rmd-automation cambios aplicar spec.yaml --matriz data/matriz_planta2.xlsx --producto "CLORFENAMINA 4 mg" --etapa Fabricación`.

Avisos de la matriz: el programa **solo avisa si hay algo anormal** (si todo está normal no muestra nada):
- el producto/etapa **no figura** en la matriz → debe incluirse (no es habitual);
- una fila del producto **sin estado de ingreso** (ni PENDIENTE ni INGRESADO) → debe completarse;
- una fila **PENDIENTE** → se muestra el motivo (columna O).

## Seguimiento del flujo
`cambios aplicar` muestra las 8 etapas (○ pendiente, ▶ en curso, ✔ hecha, – omitida, ✖ error) y escribe
`data/estado_flujo.html` (se recarga cada 3 s; se puede abrir desde cualquier navegador) y `data/estado_flujo.json`.
Validado de punta a punta en un RMD de prueba (`examples/cambios_flujo_prueba.yaml`).
