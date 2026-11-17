# Cómo se configura un RMD (aprendido de RMD reales autorizados, Planta Lima)

Fuente: lectura de solo lectura de **33 RMD autorizados** de Planta Lima (los más recientes por
etapa y área): 12 de **Fabricación**, 10 de **Envase**, 11 de **Acondicionado** — 2.460 pasos en
total. Áreas cubiertas: Cápsulas blandas, Cosméticos, Iny. hormonales, Iny. biológicos,
Mentholatum, Polvos efervescentes, Semisólidos, Semisólidos horm., Sólidos, Sólidos hormonales,
Sólidos 4 CO, Planta plásticos 2, Acondicionado y Reacondicionado. (Las áreas sin RMD
autorizado en Lima para esa etapa salieron vacías.) Los datos brutos no se versionan; aquí van las
reglas.

## 1. Esqueleto de estructuras

Orden fijo en casi todos: PRECAUCIONES · NOTAS IMPORTANTES DURANTE EL PROCESO · EQUIPOS /
INSTRUMENTOS / MATERIALES · INSUMOS · CONDICIONES AMBIENTALES · PROCEDIMIENTO · (ESPECIFICACIONES
DE PRODUCTO EN PROCESO: **GRANEL** en Fabricación / **ENVASE** en Envase / ninguna en
Acondicionado) · VERIFICACION DE FIRMAS. INSUMOS es de solo lectura ("Ver Insumos": Cód. Insumo,
Descripción, Cant. Receta, Cant. en RMD, UM) porque sale de la receta asociada.

## 2. Etiquetas dentro de PROCEDIMIENTO (siempre 5)

| Etapa | Etiquetas |
|---|---|
| Fabricación | DOCUMENTACION · PREPARACION DE LAS MAQUINAS O EQUIPOS · PREPARACION DEL MATERIAL · **FABRICACION** · RENDIMIENTO |
| Envase | DOCUMENTACION · PREPARACION DEL MATERIAL DE ENVASE · PREPARACION DE LAS MAQUINAS O EQUIPOS · **ENVASE** · RENDIMIENTO |
| Acondicionado | DOCUMENTACION · PREPARACION DEL MATERIAL · PREPARACION DE LAS MAQUINAS O EQUIPOS · **ACONDICIONADO** · RENDIMIENTO |

- El orden de las dos preparaciones varía entre RMD; las demás son fijas.
- Tamaño típico: Documentación 9–13 pasos, Preparación de máquinas 4–17, Preparación de material
  4–10, etapa principal 20–112 (Fabricación) / 7–10 (Envase) / 39–75 (Acondicionado), Rendimiento 7–13.
- Excepción: inyectables biológicos estériles (p. ej. "LINEA ROTA - VIALES") usan etiquetas propias
  (Preparación de materiales, equipos y accesorios · Preparación de la solución del medio de
  cultivo · Filtración) y **sin** Rendimiento.

## 3. Tipo de dato por estructura/etiqueta (frecuencia real)

| Dónde | Tipo de dato dominante |
|---|---|
| Precauciones, Notas importantes | Verificación Check |
| Condiciones ambientales | **Sin tipo de dato** (112 de 113; temperatura/humedad van en la descripción, no como Rango) |
| Documentación | Múltiple check (280) + Fecha y Hora (34) + Notificacion (32) |
| Preparación de máquinas / material (y de envase) | Múltiple check + Fecha y Hora + alguna Notificacion |
| FABRICACION | Realizado por (216) · Realizado por y Visto bueno (139) · Notificacion (80) · Sin tipo de dato (102) · Visto bueno (8) · Fecha y Hora (8) |
| ACONDICIONADO | Realizado por (307) · Realizado por y Visto bueno (109) · Notificacion (50) · Sin tipo de dato (74) · Fecha y Hora (16) |
| ENVASE | Múltiple check (72) + Fecha y Hora (15) + Notificacion (5) |
| RENDIMIENTO | Fórmula (129) · Números (35) · MuestraCC (32) · Entrega (32) · Sin tipo de dato (32) |

Casillas asociadas al tipo (constantes en los 2.460 pasos): Realizado por → R. Por · Realizado por y
Visto bueno → R. Por + V.B. · Visto bueno → V.B. · Notificacion / Fecha y Hora / Fórmula / Números /
Entrega → Edit · MuestraCC → Estado CC + Edit · Múltiple check y Sin tipo de dato → ninguna. "Gen PP"
aparece en muy pocos pasos; "PM OP" no debe marcarse en ninguno (indicación del equipo, septiembre de 2026). Decimal: Fórmula/Entrega/MuestraCC/Números usan 3 (o 0
cuando la unidad es entera: cajas, folios); "Sin tipo de dato" usa 0. **Decimal es obligatorio para guardar.**

### Rendimiento (plantilla casi fija)

1. Cantidad teórica / recibida (Fórmula con "CT" = Cantidad Teórica, o Números en Envase/Acond.)
2. Cantidad muestreada → **MuestraCC** (Estado CC + Edit)
3. Cantidad entregada → **Entrega**
4. Cantidad obtenida → **Fórmula** = entregada + muestreada (p. ej. `5275 = paso2 + paso3`)
5. Merma → **Fórmula** = teórica − obtenida
6. Cálculo de rendimiento (%) → **Fórmula** = obtenida / teórica * 100
7. Rango de aceptación (p. ej. 90%–100%) → Sin tipo de dato

Diálogo "Fórmulas": lista de pasos disponibles y lista de la fórmula; el select "Seleccionar signo"
ofrece `( ) + - * /` y `CT`; hay un campo "Ingrese Cantidad" para constantes (`* 100`). La fórmula se
arma **por orden de inserción** (el portal no la reordena; el Guardar graba el orden de cada término según
su posición en la lista, así que el userscript v1.25 añade Subir / Bajar) y una vista previa muestra p. ej.
`5275 / 5533 * 100`. Sin signos entre pasos la fórmula queda mal (`5224  181147`).

## 4. Notificaciones (Tipo Dato = Notificacion)

Tres claves de modelo: **Setup Pre Proceso**, **Proceso**, **Setup Post Proceso**, cada una con un
paso de inicio y otro de fin ("FECHA / HORA INICIAL/FINAL DEL SET UP", "INICIO/FINAL DE …") y el
**Puesto de Trabajo** del área (FMENFA01, FCBLFA01, FSOLFA02, AACOAC02, EACOEN04…).

- DOCUMENTACION, primer paso ("FECHA / HORA INICIO"): Setup Pre Proceso.
- Última preparación (paso final "FECHA / HORA FINAL"): Setup Pre Proceso.
- Etapa principal: por cada máquina/puesto se repite Setup Pre (ini/fin) → Proceso (ini/fin) → Setup
  Post (ini/fin). Un producto con varios puestos (encapsulado, secado, inspección) cambia el
  Puesto de Trabajo en cada tramo (Dolomax: FCBLFA01, FCBLEP01, FCBLSE01, FCBLIN01).
- Acondicionado: Proceso (ini/fin) + Setup Post (ini/fin) con su puesto. Envase casi no notifica
  dentro de la etapa principal.

## 5. Predecesores ("Depende")

Formato del campo: `código_del_predecesor (orden)`; solo admite **un** predecesor por paso. Si el
código no existe en el RMD se muestra sin `(orden)` (referencia colgante: 14 de 1.881 casos, un
riesgo de calidad tras cambiar pasos: regenerar).

Reglas observadas:

- **Cadena lineal**: cada paso depende del anterior de su etiqueta (≈ 78 %).
- **Los pasos "Sin tipo de dato" no tienen predecesor** (178 de los pasos sin predecesor) y el paso
  siguiente depende del que estaba **antes** del Sin tipo (se "salta" el encabezado) — coincide con el
  manual 7.7.
- **Primeros pasos**: DOCUMENTACION y las dos preparaciones dependen del **último paso de NOTAS
  IMPORTANTES** (en paralelo); la etapa principal depende del **último paso de la preparación
  anterior** (p. ej. Preparación del material). Acondicionado a veces queda sin predecesor en el
  primero.
- **Ramas paralelas** (≈ 208 casos, en la etapa principal): operaciones simultáneas o
  notificaciones cuyo predecesor es un paso anterior no adyacente (p. ej. "inicio de preparación"
  depende de "condiciones ambientales", "inicio del encapsulado" depende del "final de
  preparación").
- **CONDICIONES AMBIENTALES y RENDIMIENTO no llevan predecesores.**
- **Todo paso mayor con tipo de dato (distinto de "Sin tipo de dato") debe llevar predecesor** en Precauciones, Notas importantes, Procedimiento
  (todas las etiquetas salvo Rendimiento), etc. (la operación lo pidió; el linter y el userscript lo avisan). En 26 RMD leídos, los autorizados lo
  cumplen salvo casos aislados. **Cuando no aplica:** el primer paso con tipo de PRECAUCIONES (cabeza de toda la cadena), Rendimiento y Condiciones
  ambientales (no llevan), y los pasos condicionales o en paralelo por su redacción ("EN CASO QUE…", "PARALELAMENTE…", "EN PARALELO…", "BAJO LA
  SUPERVISION…", "ENTREGAR LA DOCUMENTACION ORDENADA Y FIRMADA…"). El primer paso con tipo de Notas importantes, Documentación, las preparaciones
  y la etapa principal **sí** lleva predecesor (el último de la lista anterior). **Cuidado:** el portal **vacía el Depende de una fila en cuanto se marca
  su casilla Estado CC** (comprobado en pantalla, con y sin el userscript): el predecesor se asigna *después* de marcar Estado CC.
- El botón **Generar Predecesores** genera una cadena lineal completa en orden de estructuras (incluso
  encadenando Rendimiento con el último paso de Fabricación y a los Sin tipo de dato). Sirve de base:
  después hay que **quitar** los predecesores de Rendimiento/Condiciones, **saltar** los Sin tipo de
  dato y añadir las ramas paralelas. Regenerarlo tras añadir pasos los engancha a la cadena. El aviso
  de éxito ("Se generaron los predecesores correctamente.") tarda varios segundos.

## 5 ter. Asignar "Depende" a mano (verificado en RMD PRUEBA, Fabricación de 151 pasos)

Mecanismo: en "Pasos (n)", el ícono "Mostrar ayuda para entradas" de la celda Depende abre "Lista de
Predecesores": lista de selección única con buscador que muestra **todos** los pasos del RMD
("<ESTRUCTURA> - Codigo: X … Orden: N"). Como un código puede repetirse (p. ej. "CONDICIONES
AMBIENTALES:" aparece varias veces), hay que elegir por **código y orden**. Para quitar el predecesor
se vacía el campo. Luego Guardar ("Se guardaron correctamente los cambios."). Se aplicó la regla de la
operación (predecesor = paso anterior; los "Sin tipo de dato" ni llevan predecesor ni son predecesor
del siguiente): 105 pasos encadenados, 45 "Sin tipo de dato" sin predecesor, 0 discrepancias tras
guardar y reabrir. También se comprobó que se admiten **paralelos** (dos pasos con el mismo
predecesor) y se restauró la cadena. En pantalla, el `(n)` de "código (n)" es el orden del predecesor.

### Cómo aparecen los paralelos en los RMD reales (regla "predecesor = anterior no Sin tipo")

Cumplen la regla: Fabricación 84 % (377 de 451 pasos con tipo), Acondicionado 91 % (440/482), Envase
88 % (81/92). El resto son ramas paralelas (≈ 62 en Fabricación, 35 en Acondicionado, ~1 en Envase) y
unos pocos pasos sin predecesor (7 en Fabricación). Patrones:

1. **Tareas simultáneas tras el inicio**: varios pasos con el mismo predecesor, normalmente la
   notificación de inicio ("FECHA / HORA INICIO DE FABRICACION/ACONDICIONADO"): p. ej. Mentholatum #4 y
   #6 ← #2; Acondicionado Mentholatum #9, #11, #12 ← #6. Suelen ser pasos redactados "PARALELAMENTE…"
   o "EN PARALELO…".
2. **Bloque de Control de Calidad**: "EL PERSONAL DE CALIDAD INGRESA…" (Realizado por + Estado CC)
   depende del último paso operativo (no de la notificación final): corre en paralelo con el cierre;
   "TRASVASAR EL PRODUCTO APROBADO" depende del primer paso de CC y no del Visto bueno del jefe.
3. **Notificaciones encadenadas por puesto**: "Setup Pre" del siguiente puesto ← "Setup Post final" del
   anterior; "Inicio de proceso" ← "Fin de la preparación" (NOT→NOT: 10 casos); el Setup Post inicial
   depende de la notificación de **fin del proceso**, saltándose el bloque de CC.
4. **"CONDICIONES AMBIENTALES:" repetido dentro del procedimiento** depende de un paso anterior
   (medición en paralelo con la operación).
5. **Pasos condicionales o independientes sin predecesor** ("EN CASO QUE…", "BAJO LA SUPERVISION DEL
   JEFE…", "PARALELAMENTE TRITURAR…", "ENTREGAR LA DOCUMENTACION…": los no-Sin-tipo sin predecesor).
6. Un solo predecesor por paso: el "cierre" de una rama paralela (join) se resuelve haciendo que el
   paso siguiente dependa de la rama principal; la otra rama simplemente termina.

Los primeros pasos de cada etiqueta cruzan etiquetas (`código (orden en la otra etiqueta)`).

## 5 quater. Casillas (Edit, R. Por, V.B., Estado CC, PM OP, Gen PP)

Salen del **tipo de dato**, con estas excepciones observadas en los 2.460 pasos:

| Casilla | Cuándo se marca |
|---|---|
| **Edit** | El operario registra un valor en el RMD digital: Fecha y Hora, Fecha, Hora, Notificacion, Números, Rango, Texto, Lote, Fecha Vencimiento, Fórmula, Entrega, MuestraCC, Verificación Check en procesos menores de verificación. No se marca en Múltiple check, Realizado por, Visto bueno ni Sin tipo de dato. |
| **R. Por** | Tipo "Realizado por" y "Realizado por y Visto bueno" (firma de quien ejecuta). |
| **V.B.** | "Visto bueno" y "Realizado por y Visto bueno" (firma del jefe/supervisor: pasos críticos como despejes, adiciones de insumo, trasvases). Excepciones raras: "Realizado por" o "Múltiple check" con R. Por + V.B. cuando el paso exige visto bueno. |
| **Estado CC** | Pasos de **Control de Calidad**: "EL PERSONAL DE CALIDAD … INGRESA…" y "CALIDAD … REGISTRA LOS RESULTADOS" (Realizado por + Estado CC, 34 casos), MuestraCC (Estado CC + Edit) y, en procesos menores, "CANTIDAD MUESTREADA" y "FECHA / HORA DE MUESTREO" (Edit + Estado CC). |
| **PM OP** | Paso **opcional** según la OP ("ELIJA LA OPCION SEGUN CORRESPONDA", "REALIZAR LA PRUEBA DE INTEGRIDAD… SEGÚN CORRESPONDA", "COLOCAR LAS CHAQUETAS…", "REGISTRAR LA MATERIA PRIMA…"): 3–7 casos en 33 RMD. **Indicación del equipo (septiembre de 2026): no debe marcarse en ningún paso**; el userscript (v1.21) la muestra y pide desmarcarla, y `reglas.py` la avisa. |
| **Gen PP** | Muy raro (1 caso: preparar la máquina codificadora); genera datos de producto en proceso. |
| **Estado Mov.** | No aparece marcada en ninguno de los RMD leídos. |

## 5 quinquies. Clave Modelo y Puesto de Trabajo (Notificacion + Edit)

- Tipo "Notificacion" siempre con **Edit** marcado (199 de 199).
- **Puesto Trabajo**: las opciones del combo son exactamente los puestos de la **hoja de ruta de la
  receta asociada**. Dolomax (receta 5000001459, P. Trabajo principal FCBLFA01) ofrece 4 puestos
  (FCBLFA01, FCBLEP01, FCBLSE01, FCBLIN01) y los usa en sus notificaciones. Sin receta asociada (RMD PRUEBA)
  el combo solo trae los puestos heredados. **Regla de negocio (confirmada por la operación):** a una
  versión nueva NO se le puede asociar la receta mientras la versión anterior esté autorizada y use esa
  misma receta; la asociación se hace al autorizar la nueva versión (la anterior deja de usarla). Por eso una
  versión Ingresada recién creada aparece con "Recetas Asociadas: Sin datos" e INSUMOS en 0: es el estado
  esperado, no un pendiente. Los Puestos de Trabajo de las notificaciones sí se copian de la versión anterior
  (Clorfenamina v4 conserva FSOLME02 y FSOLTA03 como la v3); una lectura anterior los dio por vacíos porque
  el combo aún no había cargado su valor al leerlo. Para RMD nuevos sin
  versión previa que use la receta, sí se asocia antes (la tabla "Recetas Asociadas" muestra P. Trabajo,
  H. Ruta y Contador). Al aprobar producción: se suspende la versión anterior, se asocia la receta si falta
  y se revisan los puestos de trabajo respecto a la versión anterior.
- **Clave Modelo**: la lista tiene 47 valores, pero solo tres se usan en notificaciones: **Setup Pre
  Proceso**, **Proceso** y **Setup Post Proceso** (el resto son nombres de personas/proveedores).
- Secuencia por puesto: 1.er puesto — Documentación "FECHA / HORA INICIO" = Setup Pre (inicio) y el
  "FECHA / HORA FINAL" de la última preparación = Setup Pre (fin); en la etapa principal: Proceso
  (inicio y fin de la preparación/fabricación) → Setup Post (inicial y final). Cada puesto siguiente:
  Setup Pre (ini/fin) → Proceso (ini/fin) → Setup Post (ini/fin).

## 5 sexies. Otros detalles de la configuración

- **Etiquetas ("Etiqueta (n)")**: "Conforme" ✓ en Documentación y en las dos preparaciones, ✗ en la
  etapa principal y Rendimiento. "Proceso Menor" ✓ siempre en la etapa principal y en la preparación que
  tiene procesos menores (Preparación del material o de máquinas según el producto); ✗ en Documentación
  y Rendimiento.
- **Procesos menores** (botón de fila azul = tiene; rojo = no tiene): son líneas de captura bajo un paso.
  Tipos reales: notas/instrucciones (Sin tipo de dato, decimal 0); **insumos** de la receta (Números,
  decimal 3, con "Cantidad Insumos", sin Edit); Hora inicio/final (Hora, Edit); velocidad/temperatura de
  proceso (Números decimal 1, Edit); presión (Texto, Edit); **temperatura y humedad ambiental
  (Rango 15–25 / 1–100, margen 10, decimal 1, Edit)** dentro del paso "CONDICIONES AMBIENTALES:";
  muestreo de CC (Números decimal 3 + Fecha y Hora, Edit + Estado CC); verificación del jefe
  (Verificación Check, Edit); en Acondicionado además Lote, Texto (fecha de elaboración/expira),
  Verificación Check por máquina y Rango de velocidad de faja. Los procesos menores no tienen "Depende".
  Envase (ejemplo 2202608966) no tenía procesos menores en la etiqueta ENVASE.
- La estructura **CONDICIONES AMBIENTALES** de un RMD son solo textos (Sin tipo de dato): los valores
  medibles se capturan en los procesos menores del paso "CONDICIONES AMBIENTALES:" del Procedimiento.
- **INSUMOS** (estructura 4) es solo lectura ("Ver Insumos"): viene de la receta asociada
  (Cód. Insumo, Descripción, Cant. Receta, Cant. en RMD, UM); sin receta no hay insumos que asignar a los
  procesos menores.

## 5 bis. Qué tener en cuenta al configurar

1. Añadir pasos del catálogo existente; no crear pasos maestros sin necesidad (afecta a todos los RMD).
2. Tipo de dato según la tabla del apartado 3 (no usar Rango/Números para condiciones ambientales).
3. Marcar las casillas que corresponden al tipo (R. Por, V.B., Edit, Estado CC).
4. Poner **Decimal** siempre; guardar; recién entonces aparece el botón "Fórmula".
5. Formulas con signos en orden; verificar la vista previa antes de guardar.
6. Notificaciones: Clave Modelo + Puesto de Trabajo del área, inicio y fin en pareja.
7. Predecesores: Generar Predecesores, luego refinar (Sin tipo de dato, Rendimiento, ramas).
8. Al terminar: Configuración Inicial (avisa con "¿Desea realizar la configuracion inicial?") y revisar.

## Correcciones a la prueba anterior (RMD PRUEBA)

- La fórmula de "Cantidad obtenida" se guardó primero sin signo; se rehízo como `5224 + 181147`.
- Temperatura/humedad de Condiciones ambientales se habían puesto como Rango; en la práctica real son
  "Sin tipo de dato" y se revirtieron.

## 5 sexies. Calidad en Operaciones, insumos y textos (validado en RMD de septiembre de 2026)

Fuente: lectura de solo lectura de los últimos RMD **Autorizados** e **Ingresados** de Planta Lima (Fabricación, Envase,
Acondicionado y Recubrimiento; áreas Sólidos, Cápsulas blandas, Cosméticos, Semisólidos, Polvos efervescentes, Mentholatum…).

**Calidad en Operaciones (lo último que se implementó).** El paso mayor va como **Realizado por** con **R. Por + Estado CC** cuando
lo ejecuta el personal de Calidad: "EL PERSONAL DE CALIDAD EN OPERACIONES INGRESA A LA SALA DE FABRICACION Y REALIZA EL MUESTREO…",
"EL PERSONAL DE CALIDAD EN OPERACIONES REALIZA EL CONTROL INSPECTIVO DEL PROCESO Y RETIRA SUS MUESTRAS…" y
"CALIDAD EN OPERACIONES REGISTRA LOS RESULTADOS:". Sus procesos menores son:

| Proceso menor | Tipo | Casillas |
|---|---|---|
| TOMAR LA MUESTRA DEL BULK… (opcional) | Sin tipo de dato | ninguna |
| CANTIDAD MUESTREADA (unidad): | Números (decimal 3 en kg; según la unidad) | Edit + Estado CC |
| FECHA / HORA DE MUESTREO: | Fecha y Hora | Edit + Estado CC |
| EL JEFE O SUPERVISOR DE LA SECCION VERIFICA… (opcional) | Verificación Check | Edit |

Otros pasos que mencionan a Calidad en Operaciones **no** llevan Estado CC: "SOLICITAR A CALIDAD EN OPERACIONES LA DETERMINACION DE…",
"ESPERAR RESULTADOS DE CALIDAD EN OPERACIONES…" (Realizado por + R. Por) y "EL JEFE O SUPERVISOR… VERIFICA… POR CALIDAD EN OPERACIONES"
(Visto bueno + V.B.).

**Rendimiento.** El paso de muestra es **MuestraCC** (Edit + Estado CC) y se llama **"CANTIDAD MUESTREADA (unidad):"**, ya no
"MUESTRA PARA CONTROL DE CALIDAD (…)".

**Insumos** (procesos menores con Cantidad Insumos / UM, tipo Números): **sin ninguna casilla**, tampoco Edit (36 de 36).

**Precauciones y Notas importantes** ahora usan **Múltiple check** (sin casillas), no Verificación Check. En procesos menores,
Verificación Check sí lleva Edit (41 de 41).

**Orden de las estructuras**: el habitual es el de los últimos autorizados de la misma planta, sección y etapa (Precauciones, Notas importantes,
Equipos / Instrumentos / Materiales, **Insumos**, Condiciones ambientales, Procedimiento, Especificaciones, Verificación de firmas, con variaciones
por etapa). Por error hubo autorizados con INSUMOS al final (7 en el historial, 6 por INSUMOS): el userscript v1.22 lo avisa en la ventana raíz.

**Textos que cambiaron** (la operación pidió reemplazar todo "CONTROL DE CALIDAD" por "CALIDAD EN OPERACIONES"):
- Nota del granel (Envase, Notas importantes): antes "…APROBACION DE CONTROL DE CALIDAD O CONTROL DE PROCESO, SEGUN APLIQUE" (se alerta:
  hay que cambiarla). La redacción vigente **"VERIFICAR QUE EL GRANEL TENGA LA APROBACION DE CONTROL DE CALIDAD O CALIDAD EN OPERACIONES,
  SEGUN APLIQUE."** es **correcta** (la operación lo confirmó; está en los RMD de Envase autorizados): nombra a Calidad en Operaciones, así que
  no se alerta (tampoco con las dos áreas al revés). Fuera de esa fórmula, cualquier otro "CONTROL DE CALIDAD" se alerta: solo debe quedar
  Calidad en Operaciones.
- **"FINALMENTE ENTREGAR EL FORMATO DE INSPECCION EN LINEAS DE PRODUCCION (FPRO-250 VIGENTE) A CONTROL DE CALIDAD PARA SU APROBACION
  EN EL SISTEMA, ASI COMO EL SOBRE TECNICO CON LA DOCUMENTACION AL AREA DE ASEGURAMIENTO DE LA CALIDAD."** (cierre de Acondicionado)
  también es **correcto** (la operación lo confirmó): no se alerta, ni con tildes. Solo se exceptúa esa frase: si el mismo paso trae otro
  "CONTROL DE CALIDAD", ese sí se alerta.
- **Biocarga**: los pasos mayores que mencionan biocarga, como **"EL PERSONAL DE CONTROL DE CALIDAD MUESTREA (100 mL) PARA ANALISIS DE
  BIOCARGA, SEGUN LO INDICADO EN EL PROCEDIMIENTO PCMB-200 VIGENTE."**, son **correctos**: el análisis de biocarga lo hace Control de Calidad
  (indicación del usuario, septiembre de 2026). No se alertan; en los procesos menores sí se sigue alertando "CONTROL DE CALIDAD".
- "ESPERAR RESULTADOS DE CONTROL DE CALIDAD…" (Fabricación) todavía aparece con el texto antiguo incluso en RMD autorizados
  de septiembre de 2026: hay que actualizarlo.
- Los RMD **Ingresados** revisados aún traían: paso de muestra "MUESTRA PARA CONTROL DE CALIDAD (FOLIOS):" (Envase),
  y pasos de Calidad en Operaciones sin Estado CC (Fabricación cápsulas blandas #24 y #25; Acondicionado #33).

El linter (`revisar`) y el userscript de Tampermonkey avisan de todo esto.

## 5 septies. Especificaciones: qué guarda y cómo ordena el portal (leído del código de la app, solo lectura)

Cada fila de la ventana **Especificaciones** es un registro `MD_ES_ESPECIFICACION`: `ensayoPadreId` (grupo, del catálogo; es el título en negrita),
`ensayoHijo` (la descripción), `especificacion` (el texto), `tipoDatoId`, `valorInicial`, `valorFinal`, `margen`, `decimales`, `orden`, y, si vienen de SAP,
`ensayoPadreSAP` y `Merknr` (número de característica).

- El **Guardar del portal solo actualiza** Tipo Dato, Valor Inicial/Final, Margen y Decimal (más fecha y usuario de actualización) de **todas** las filas:
  **no envía `ensayoHijo`, `especificacion` ni `orden`**. Por eso, sin ayuda, no se puede corregir un texto ni cambiar el orden (solo borrar y volver a agregar).
- **Orden al mostrar:** si ninguna fila viene de SAP, por `orden`; si todas vienen de SAP, por `Merknr` (el `orden` se ignora); con mezcla el criterio es incoherente.
  Las filas nuevas reciben `orden = (número total de especificaciones del RMD) + 1`, así que los valores de una estructura no tienen por qué ser consecutivos.
- **Agregar**, **Eliminar** y **Ensayos SAP** vuelven a leer del servidor: lo que estuviera editado y sin guardar se pierde. (Ensayos SAP además **escribe**: trae de la receta
  las características que aún no están.)
- El userscript añade a esa misma actualización de cada fila los textos y el orden que el usuario haya cambiado (`model.update` del propio portal, sin otra vía), y solo
  permite reordenar cuando ninguna fila viene de SAP. Los objetos de las filas se comparten en memoria con el resto del portal, por eso, si se cierra la ventana sin guardar,
  el script restablece lo último guardado.

## 5 octies. Pasos compartidos entre RMD, selector de pasos y recetas (leído del código de la app, solo lectura)

- Un **PASO** (catálogo) puede estar en muchos RMD: MD_ES_PASO (paso mayor) y MD_ES_PASO_INSUMO_PASO (proceso
  menor) apuntan a él. **Editar Paso → Grabar** (`onGrabarPasoPadre`): si el paso está en otro RMD
  **Autorizado o Suspendido**, pregunta "El paso se encuentra en otro RMD. ¿Desea generar uno nuevo?" y crea
  un PASO nuevo con el siguiente código **aunque ya exista otro con la misma descripción** (de ahí los pasos
  duplicados con distinto código). Si no, pregunta "¿Está seguro de editar el Paso?" y **sobrescribe** el
  PASO: el cambio aparece también en los demás RMD **Ingresados** que lo usan, sin avisar. El userscript v1.25
  pregunta antes (generar nuevo / sobrescribir, con los RMD afectados) y reutiliza el paso existente si ya
  hay uno con esa descripción.
- **Adicionar Pasos → Agregar** (`onAsignPasoToEstructura`) agrega, en orden, un paso por cada elemento de la
  barra de seleccionados (modelo `aSeleccionadoPaso`), con orden = pasos actuales + posición. El portal acepta
  el mismo paso varias veces en una etiqueta (hay RMD así); lo que lo impedía era la barra, que quitaba los
  repetidos al marcar otra fila.
- **Recetas y puesto de trabajo**: en los RMD leídos, todas las recetas asociadas a un mismo RMD tienen el
  mismo puesto de trabajo principal (`Mdv01` de la receta); el portal no lo comprueba al asociar (v1.25 sí).
- **Producción Estatus**: los destinatarios del envío a revisión están en `destinatariosMD` del RMD (tipo
  DJEFPROD = jefe de producción, DGERPROD = gerente, DJEFDOCT = jefe de documentación) con el id de usuario;
  el nombre sale del catálogo USUARIO.

## 5 nonies. Documentos citados y vigencia (userscript v1.34)

- Los pasos y procesos menores citan documentos del DMS por su código: instructivos, procedimientos y formatos
  `<I/P/F><Área>-<sufijo NNN>` (IPRO-P123, PCPR-202, FPRO-250), manuales `M<Área>-NNN` (MCAL-200) y políticas
  `POL-<Área>-NNN` (POL-CAL-001). **SAP no comprueba si el documento citado sigue vigente.**
- La referencia es la **lista de documentos vigentes del DMS** (exportación "Lista_ Documento", un `.xls` de
  Excel 97-2003 con una hoja "Worksheet": columna `S` = estado — Aprobado / Emisión / Revisión —, Categoría
  (F, I, P, M, POL), Identificador, Título, Revisión, Fecha y Validez; en septiembre de 2026, 3417 documentos).
  **Criterio: si el código está en la lista, está vigente; si no está, no lo está** (el estado y la validez
  son solo informativos).
- El userscript carga esa lista en el navegador (Reglas de revisión → Documentos vigentes), resalta en rojo
  los códigos citados que no están en ella, lo avisa en la lista y en la ventana del RMD, y "Documentos
  citados" muestra la columna Vigente. Conviene volver a cargar la lista cuando el DMS cambie (el script
  avisa si tiene más de 30 días).

## 5 decies. Equipos calificados (OQ / PQ) (userscript v1.35)

- Los equipos de la estructura **EQUIPOS / INSTRUMENTOS / MATERIALES** (MD_ES_EQUIPO) tienen dos códigos: el
  **"Código de referencia"** (CodigoGaci, p. ej. PL1-PV1-E025) y el **código SAP** (equnr, p. ej. 10000312).
- Su calificación está en el **registro de áreas / sistemas / equipos a calificar (OQ y PQ)** de Garantía de la Calidad
  (Calibración y Calificación): hoja **"Cronograma"**, encabezados en la fila 13; «CODIGO MIF» = Código de referencia,
  «CÓDIGO SAP», estado de OQ, estado de PQ y **«ESTADO GENERAL» (columna AU)**. En septiembre de 2026: 1 338 filas
  (1 285 códigos) — CALIFICADO 871, INOPERATIVO 187 (dados de baja), EN PROCESO 116, PENDIENTE 95, NO CUMPLE 32,
  NO REQUIERE 29, COMPLETAR CAMPOS 6. Las salas aparecen dos veces con el mismo código (la sala y su HVAC); no
  incluye utensilios ni instrumentos (balanzas, termómetros).
- **Criterio del userscript:** un equipo está calificado si su ESTADO GENERAL es CALIFICADO o NO REQUIERE (se puede
  cambiar); si no, "sin calificación". Con varias filas, lo está solo si lo están todas.
- Ejemplo real (27/09/2026): TRAMEDIF 100 mg INY (2202609126) usa PL1-PV1-E030 (tanque reactor de 500 L; OQ
  calificado, PQ por programar), PL1-PV1-E018 y PL1-PV1-E092 (módulos de flujo laminar): los tres EN PROCESO.

## 5 terdecies. El PDF del RMD y el borrador de Producción (v1.40–v1.41)

- **Cómo arma el portal el PDF** (`mif/rmd/configuracion/controller/table.js`, `onGeneratePdf`, con pdfMake): primero lee 8 listas del RMD (`MD_ESTRUCTURA`, `MD_ES_PASO`, `MD_ES_EQUIPO`, `MD_ES_UTENSILIO`, `MD_ES_ETIQUETA`, `MD_ES_RE_INSUMO`, `MD_ES_ESPECIFICACION`, `MD_ES_PASO_INSUMO_PASO`) y las ordena por `orden` (insumos por `ItemNo`).
  - **Numeración:** una estructura lleva número solo si en el catálogo `ESTRUCTURA.numeracion` es verdadero (no depende del tipo: «CONDICIONES  AMBIENTALES» es de tipo Cuadro y se numera; Precauciones y Notas no). Cada etiqueta: `n.m` con m = su posición. Cada paso: `n.(orden de la etiqueta).(orden del paso)`: usa los `orden` guardados, no la posición.
  - **Tipos de estructura** (MAESTRA): 483 Condiciones Ambientales, 484 Cuadro, 485 Equipos, 486 Especificaciones, 487 Procesos, 488 Fórmula (Insumos), 489 Verificación de firmas.
  - **Encabezado** (en cada página): tabla de 8 columnas (anchos 60, 80, 68, 28, 45, 75, 53, 60) con el logo (una imagen JPEG en base64 dentro del mismo `table.js`, `var E="data:image/jpeg;base64,…"`), «REGISTRO DE MANUFACTURA», Etapa, Emitido, Página, la descripción, Orden N°, Lote, Expira, Teórico y la fila Código · Version Fab./Alt. · Edi. Reg. Manuf. (la versión del RMD) · **Estado / Fecha / Por** · Fecha de la etapa (Inicio, Fin). «Estado / Fecha / Por»: si está Autorizado (465), la fecha y el usuario de la autorización (`fechaAutorizacion`, `usuarioAutorizacion`); si no, la última fila de `MD_TRAZABILIDAD`. Fechas como `aaaa-mm-dd`; cantidades con 3 decimales y los miles separados por espacio.
  - **Filas:** las estructuras con `verificadoPor` cierran con «VERIFICADO POR: / FECHA:»; en Procesos, también cada etiqueta `conforme` (que además lleva «(Colocar check en caso de conformidad)» y un check por paso). La casilla de cada paso sale de sus marcas y su tipo de dato: Edit → caja de dato; R. Por / V.B. → «Realizado Por», «VB» o «Realizado Por / VB»; Texto, Cantidad, Fechas, Hora, Números, Rango, Lote, Fórmula → caja; Verificación Check y Múltiple check → check; el resto sin casilla. Insumos: solo los de prioridad (`AiPrio`) «00» y «01».
  - **Tipos de dato** (MAESTRA, código TDDxx): 432 Verificación Check, 433 Texto, 434 Cantidad, 435 Fecha, 436 Fecha y Hora, 437 Hora, 438 Números, 439 Realizado por, 440 Visto bueno, 441 Realizado por y Visto bueno, 442 Múltiple check, 443 **Rango** (único que habilita valor inicial, final, margen y decimales en «Nuevo Paso»; Números y Cantidad solo decimales), 444 Lote, 445 Fórmula, 446 Sin tipo de dato, 447 Notificación, 448 MuestraCC, 449 Fecha Vencimiento, 450 Entrega.
- **Catálogo de pasos `PASO`:** 91 695 filas (2026-10-02); 88 820 de PROCEDIMIENTO. Campos: código, descripción, estructura, etiqueta, tipo de dato, `estadoId` (1 = «De Baja», 60 pasos), valores, `numeracion`. Leído entero en ~16 s (páginas de 1000, 6 a la vez); en JSON 13,9 MB, comprimido 3,5 MB. Equipos: `EQUIPO` (17 913: `equnr` = Código, `CodigoGaci` = Código de referencia, `eqktx`), `UTENSILIO` (1 273) y agrupadores `UTENSILIO_CLASIFICACION` (86).
- **Duplicados:** el portal, al crear un paso, busca `tolower(descripcion)` igual en la misma estructura y etiqueta (ver «Nuevo/Editar Paso»). La plantilla hace lo mismo con el texto normalizado (sin tildes ni signos) y además muestra parecidos.
- **La plantilla** guarda dentro del .html el árbol del RMD (ids de cada fila), el catálogo empacado y una «huella» del RMD; el borrador de Producción es el árbol editado (los archivos de la v1.40 lo llaman «propuesta» y se siguen leyendo). Al importar, los cambios se recalculan comparando los dos árboles; si el destino es otra versión del master, las filas se emparejan por estructura + etiqueta + código de paso (+ ocurrencia). **Solo se importa en un RMD Ingresado (467):** el de la plantilla si sigue Ingresado o la versión Ingresada más nueva del master; si no hay (p. ej. el RMD sigue Autorizado), primero se crea la versión nueva en el portal.
- **Ojo al probar:** recién cargada la página, durante unos segundos el portal no responde lecturas OData (se pierden sin respuesta, también sin el script). La plantilla prueba una lectura corta antes de empezar y, si no hay respuesta, avisa que se recargue la página.

## 5 duodecies. Qué se guarda de cada cambio (v1.38)

- **Versiones**: cada versión de un RMD es un registro `MD` aparte con **código propio** (p. ej. 2202507339 es la v3 del linaje 2202503967); el linaje se busca por `codigoversionprincipal` (o el código principal). Sus estructuras, etiquetas, pasos, procesos menores, insumos, recetas y especificaciones son filas nuevas de cada versión, y se emparejan por estructura + etiqueta + código de paso (los mismos en todas las versiones), con un número de ocurrencia por orden.
- **Quién y cuándo en cada fila**: `usuarioRegistro`/`fechaRegistro` y `usuarioActualiza`/`fechaActualiza` guardan solo lo último. **Al autorizar, el portal vuelve a crear las filas a nombre de quien autoriza** (p. ej. los pasos de la v3 del 2202507339, registrados por NCUELLARL a las 22:20:09 y la autorización a las 22:20:50): esas filas no dicen quién editó.
- **`MD_TRAZABILIDAD`**: solo cambios de estado (Estado, Registrado, Usuario Registro). **`RMD_ES_HISTORIAL`**: registros de producción de la OP, no del master.
- **`AUDITORIA`** (89 millones de filas, desde enero de 2024, la lee cualquier usuario del portal): por cada guardado, `serviceName` (`CatalogService.MD_ES_PASO`…), `eventAction` (CREATE/UPDATE), `eventStatus` (cada guardado sale dos veces: `Process` y `Success`; se usa `Success`), `timestamp` y `value` con el contenido enviado en JSON, que incluye **`usuarioActualiza` (el usuario real)**; `userName` sale siempre «privileged». El portal reenvía a veces la fila completa y a veces solo algunos campos, así que el «antes» se calcula acumulando los guardados anteriores de la misma fila. Las filas creadas por copia masiva no tienen alta.
- **Rendimiento**: filtrar por `serviceName` + `eventStatus` + `Contains(value, id)` cuesta ≈ 1-3 s por fila (el MD ≈ 25 s) y **no mejora en paralelo ni con ventanas de fechas**; `$inlinecount` ignora los filtros; ordenar sin filtro es lento. Por eso se consulta fila por fila, a demanda. No se pueden encontrar las filas eliminadas (ya no hay identificador vivo).

## 5 undecies. La OP guarda su propia copia del master y las recetas cambian en SAP (userscript v1.37)

- Al asociar una receta, el portal copia en el RMD su lista de materiales (`MD_ES_RE_INSUMO`, por `mdRecetaId`) y los datos de su versión de
  fabricación (`RECETA`: puesto principal `Mdv01`, hoja de ruta `Plnnr`, contador `Alnal`, alternativa `Stlal`). Esa copia no se actualiza sola:
  cambia solo si la receta se retira y se vuelve a asociar. Por eso un RMD (Ingresado o Autorizado) puede tener la receta distinta en SAP.
- SAP (`MaterialSet`) solo responde **una** lista de materiales por lectura (material + planta + alternativa); sin la alternativa, o con varios
  materiales, da error 500. `ProduccionVSet` sí admite muchos materiales de una vez (por planta). Cada componente trae `ValidFrom` («dd.mm.aaaa»,
  la fecha del cambio) y `ChangeNo` (número de cambio); SAP no da la hora ni la fecha de cambio de la hoja de ruta.
- En septiembre de 2026 había 2 157 RMD Ingresados o Autorizados (2 032 al quedarse con la última versión de cada uno: 288 Ingresados y
  1 744 Autorizados) con 4 246 recetas asociadas (4 068 listas de materiales distintas). Leer todas en SAP puede tardar de 10 a 40 minutos
  según la carga de SAP (una revisión de 603 listas tardó entre 5 y 11 minutos; 57 listas, 7 segundos): por eso la revisión es por tandas.
- **La OP tiene su propia copia del master.** «Ver OP» (Ordenes de Producción Asociadas) lee la entidad `RMD` de la OP (con `ordenSAP`, `lote`,
  fechas de inicio y fin) y `RMD_ES_PASO` (una fila por paso, con su propio `rmdEstructuraPasoId`, y datos de producción: `flagEditado`,
  `contModif`, `realizadoPorUser`, `firstFechaActualiza`…), más `RMD_ES_HISTORIAL` (los registros de cada paso: quién y cuándo) y `RMD_USUARIO`. Se
  crea al asociar la OP; cambios posteriores en el master no la reescriben (los registros de producción van en la copia).
- **Un paso de una etiqueta puesto en la lista de otra.** Cada fila del master (`MD_ES_PASO`) está en una lista (`mdEsEtiquetaId`), pero el paso
  del catálogo (`PASO`) tiene su propia etiqueta (`etiquetaId_etiquetaId`). Caso real (RMD 2202507339 v3 y 2202609025 v4): el paso 183405
  («CONCLUIDO EL PROCESO, EL RESPONSABLE DE LA LÍNEA VERIFICARÁ…») es de la etiqueta **ACONDICIONADO** en el catálogo (creado el 14/09/2026) pero
  estaba en la lista **INSPECCION DE PARTICULAS VISIBLES**; en producción (OP 2600003884, lote 2080326) el paso 4.4.24 no aparecía (saltaba de
  4.4.23 a 4.4.25) y los registros de la OP no tienen ninguna entrada de ese paso. Es un dato, no algo que hiciera el script: el paso se creó antes
  de que existiera el userscript (21/09) y el master ya lo traía al autorizarse (24/09). Para detectarlo: comparar `mdEsEtiquetaId → etiquetaId`
  de la fila con `pasoId/etiquetaId_etiquetaId` (solo hay diferencias en esos dos RMD de 70 pasos).
