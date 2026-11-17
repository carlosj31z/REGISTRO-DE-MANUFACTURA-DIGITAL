# Homologación de RMD: términos, códigos y estructura

Referencia para el ingreso automatizado y la Edición rápida. Sale de leer en el
portal (solo lectura, 2026-11-09, Chrome de pruebas de CINTIA) los RMD
**Autorizados de fase 2 y 2R** de las dos plantas y compararlos con su penúltima
y antepenúltima versión. Planta 1 = ATE, Planta 2 = LIMA.

Datos para el código: `src/rmd_automation/datos/homologacion_pasos.csv` (tabla
paso viejo → paso vigente) y `src/rmd_automation/homologacion.py` (reglas de
texto y búsqueda del reemplazo).

## Qué se revisó

- **136 autorizados de fase 2** (los 3 más recientes de cada sección y etapa con
  versión anterior; 59 combinaciones de planta, sección y etapa) contra **242
  versiones anteriores**. Todas las secciones y etapas de ATE y LIMA que tienen
  un autorizado F2 con versión previa.
- **Envase y Acondicionado a fondo**: los **411 autorizados F2** de esas etapas
  (259 de Envase, 301 de Acondicionado contando las dos plantas), para ver qué
  pasos comparten entre productos y secciones.
- Se leyó directo del servicio OData del portal (`MD`, `MD_ESTRUCTURA`,
  `MD_ES_PASO`, `PASO`), sin abrir ni guardar nada.

## La regla principal: se cambia el paso, no el texto

En los autorizados, la homologación casi nunca edita el texto de un paso. Lo que
hace el equipo es **quitar el paso viejo y poner otro código del maestro de
pasos que ya trae el texto correcto**. Ejemplo: la nota de los vistos buenos con
PDSG-202 (pasos 161493 y 1655) se reemplazó por el paso **182341** con PDOC-207
(creado el 2026-08-19 por KMORENOM) en ATE y LIMA, 52 veces en la muestra.

Para automatizar:

1. Antes de agregar o editar un paso, buscar su código en
   `homologacion_pasos.csv` (por planta). Si hay código vigente, usar ese.
2. Si no está en la tabla, pasar el texto por `homologar()` y buscar en el
   maestro de pasos un código activo con ese texto exacto (y la misma estructura).
   Si existe, usarlo. Solo si no existe se crea uno nuevo, y eso es CONSULTA.
3. Al cambiar el paso, conservar la configuración que tenía el vigente en los
   autorizados recientes (columnas `tipo_dato`, `rpor`, `vb`, `estado_cc` de la
   tabla), el orden y el predecesor del paso que se quita.
4. Anotar en Observaciones qué pasos se homologaron (p. ej. «Se homologa
   161493 → 182341 (PDOC-207)»).

## Desfase actual

Aunque la campaña avanza, **116 de 198** autorizados F2 desde agosto de 2026 (y
261 de 266 de antes) todavía tienen al menos un paso viejo de la tabla. Por
planta y etapa (autorizados F2 leídos):

| Planta / etapa | Con pasos por homologar |
|---|---|
| ATE Acondicionado | 55 de 106 |
| ATE Envase | 65 de 82 |
| ATE Fabricación | 14 de 21 |
| ATE Inspección | 4 de 6 |
| LIMA Acondicionado | 121 de 125 |
| LIMA Envase | 96 de 98 |
| LIMA Fabricación | 18 de 20 |
| LIMA Recubrimiento | 4 de 4 |

Los más frecuentes: LIMA 161493 (PDSG-202, 165 RMD), LIMA 109913, 31840
(«hagan»), 109610, 128381, 129571 (códigos sin «INSTRUCTIVO»/«PROCEDIMIENTO»),
ATE 1655 (PDSG-202, 83 RMD).

## Términos homologados

Todo en MAYÚSCULAS y sin tildes (la Ñ se conserva). Cada regla tiene su clave en
`homologacion.REGLAS`.

| Antes | Ahora | Veces / dónde | Clave |
|---|---|---|---|
| SEGUN EL POE **PDSG-202** VIGENTE (nota de los VB) | SEGUN EL POE **PDOC-207** VIGENTE | 58 cambios; ATE y LIMA, todas las etapas | `pdoc-207` |
| (V°B°), (V.B) | (VB) | con la nota anterior | `vb` |
| CONTROLAR QUE SUS COMPAÑEROS **HAGAN** LO MISMO | … **REALICEN** LO MISMO | 41; ATE y LIMA | `realicen` |
| EL PERSONAL DE **CONTROL DE CALIDAD** INGRESA / REALIZA EL CONTROL INSPECTIVO | EL PERSONAL DE **CALIDAD EN OPERACIONES** … | ~100 cambios de palabra; sobre todo LIMA | `co-personal` |
| CONTROL DE CALIDAD REGISTRA LOS RESULTADOS : | CALIDAD EN OPERACIONES REGISTRA LOS RESULTADOS: | ATE y LIMA Fabricación | `co-registra` |
| … EMITIDOS POR CONTROL DE CALIDAD | … EMITIDOS POR CALIDAD EN OPERACIONES. | LIMA Fabricación | `co-emitidos` |
| COMUNICAR A CONTROL DE CALIDAD | COMUNICAR A CALIDAD EN OPERACIONES | ATE Inspección | `co-comunicar` |
| AL INSPECTOR (DE CONTROL DE CALIDAD) | EL PERSONAL (DE CALIDAD EN OPERACIONES) | ATE Acondicionado | `co-inspector` |
| APROBACION DE CONTROL DE CALIDAD O **CONTROL DE PROCESO**, SEGUN APLIQUE | … O **CALIDAD EN OPERACIONES**, SEGUN APLIQUE | 10; LIMA Envase | `co-control-proceso` |
| SEGUN **LA TABLA DE MUESTREO DEL** POE PCPR-202 / PCPR-204 | SEGUN EL POE PCPR-202 / PCPR-204 | 32; LIMA | `tabla-muestreo` |
| **CONTRAMUESTRA** (CJA): | **CANTIDAD MUESTREADA** (CJA): | 9; LIMA Acondicionado | `contramuestra` |
| **MUESTRA(S) PARA CONTROL DE CALIDAD** (L/KG/AMP/FCO/TUB/CAJAS): | **CANTIDAD MUESTREADA** (unidad): | ~60 pasos quitados/agregados; ATE y LIMA | `muestra-cc` |
| PARIHUELA(S) | PLATAFORMA(S) | 13; LIMA Acondicionado | `plataforma` |
| LA HOJA DE INSPECCION (EN LINEAS DE PRODUCCION) | EL FORMATO DE INSPECCION EN LINEAS DE PRODUCCION (FPRO-250 VIGENTE) | LIMA Acondicionado | `hoja-inspeccion` |
| … EN LA PREPARACION DE MAQUINAS. | … EN LA PREPARACION DE MAQUINAS O EQUIPOS. | 7; ATE Envase | `maquinas-equipos` |
| IDENTIFICACION DE **AREAS** Y MAQUINAS | IDENTIFICACION DE **SALAS** Y MAQUINAS | ATE y LIMA Acondicionado | `salas` |
| PRODUCTO **AUTOCLAVADO** | PRODUCTO **ESTERILIZADO** | ATE Acondicionado | `esterilizado` |
| ALMACEN DE **PRODUCTOS TERMINADOS** | ALMACEN DE **PRODUCTO TERMINADO** | LIMA Acondicionado | `producto-terminado` |
| MERMA DE **ENVASE** | MERMA DE **ENVASADO** | ATE Envase | `envasado` |
| Y/O CAMBIO DE TURNO | Y/O **HAY** CAMBIO DE TURNO | LIMA Acondicionado | `hay-cambio` |
| USAR EL UNIFORME … SEGUN POE **PBEB-200** | … SEGUN POE **PPRO-243** | ATE Acondicionado | `ppro-243` |
| SEGUN IPRO-P212 VIGENTE | SEGUN **INSTRUCTIVO** IPRO-P212 VIGENTE | 24; sobre todo LIMA | `instructivo` |
| SEGUN PPRO-200 VIGENTE | SEGUN **POE** PPRO-200 (LIMA usa también **PROCEDIMIENTO** PPRO-200) | ATE y LIMA | `procedimiento` |
| IACO-P202. / IPRO-P212. (sin «vigente») | INSTRUCTIVO IACO-P202 VIGENTE. | LIMA Acondicionado | `vigente` |
| FECHA / HORA INICIO : | FECHA / HORA INICIO: | | `fecha-hora` |

Otros cambios de redacción que el equipo hizo y que conviene seguir cuando el
paso existe en el RMD (no tienen regla automática, están en la tabla con clase
`redaccion`):

- LIMA Acondicionado: programar en la codificadora «NUMERO DE LOTE, **FECHA DE
  ELABORACION**, FECHA DE EXPIRA Y EL TEXTO ADICIONAL…» (paso 181115).
- LIMA Envase (inyectables hormonales): «INSUMOS» pasa a «**BULK**» en los pasos
  de entrega y de precauciones (183417, 183464).
- LIMA Envase: el control de peso cada hora agrega «Y REGISTRAR EN EL FORMATO
  FCPR-211 VIGENTE» (176451).
- ATE: «ROTULAR LA LINEA» pasa a «IDENTIFICAR LA LINEA» (165740); se agrega
  «SEGUN POE PPRO-216 VIGENTE» a identificar materiales (167606).
- ATE Envase estériles: «LIMPIOS Y SANITIZADOS» pasa a «LIMPIOS, SANITIZADOS Y
  ESTERILIZADOS» y se quita «(SEGUN APLIQUE)» (170624).
- ATE: «ENTREGADA AL ALMACEN» pasa a «A ENTREGAR AL ALMACEN» (167602); el
  conteo de partículas agrega «PREPARAR EL CONTADOR DE PARTICULAS Y» (184164).

## Códigos de documento

- **PDSG-202 → PDOC-207**: el único reemplazo de código general. PDSG-202 bajó
  de 180 a 55 apariciones entre las versiones anteriores y las autorizadas.
- **PBEB-200 → PPRO-243** (uniforme de ingreso, ATE Acondicionado).
- Dejaron de usarse en los autorizados F2: **ICPR-P206** (muestreo; ahora el
  paso de calidad en operaciones con PCPR-202) e **ICML-P210** (control
  inspectivo; ahora PCPR-204). Bajaron mucho: IPRO-S203, PSSM-209, FPRO-251,
  PACO-214 (el formato FPRO-250 reemplaza a «la hoja de inspección»).
- Cómo se cita: un código que empieza con **I** va con «INSTRUCTIVO» (1 337
  veces en los autorizados) y uno que empieza con **P**, con «POE» (811) o
  «PROCEDIMIENTO» (74, más en LIMA). Siempre termina en «VIGENTE». Los
  formatos van como «EN EL FORMATO FPRO-250 VIGENTE» o entre paréntesis
  «(FPRO-250 VIGENTE)».
- Formatos que aparecen en las versiones nuevas: FPRO-250 (inspección en
  líneas), FPRO-270 (destrucción), FCPR-211 (control de peso/volumen),
  FPRO-383, FCPE-207 (hoja de potencia), FPRO-202 (rótulo de producto en
  proceso).

## Estructura

El orden de estructuras de los autorizados F2 es fijo (en ATE y LIMA):

- **Envase, Fabricación, Recubrimiento**: PRECAUCIONES > NOTAS IMPORTANTES
  DURANTE EL PROCESO > EQUIPOS / INSTRUMENTOS / MATERIALES > INSUMOS >
  CONDICIONES AMBIENTALES > PROCEDIMIENTO > ESPECIFICACIONES > VERIFICACION DE
  FIRMAS.
- **Acondicionado e Inspección**: lo mismo **sin** ESPECIFICACIONES.

Pasos que se quitan al pasar a fase 2:

- «SOLICITAR AL JEFE O SUPERVISOR DE TURNO, ASIGNE LOS NOMBRES DE LAS PERSONAS
  QUE LLEVARAN A CABO EL PROCESO.» (36 RMD; queda en 15 de 198 autorizados
  recientes).
- LIMA: la nota «CUANDO SE ELIGE LA OPCION "NO APLICA" SE DEBERA DESCRIBIR EL
  MOTIVO EN OBSERVACIONES.» (54 versiones anteriores, 1 autorizado reciente).
- Los «MUESTRA(S) PARA CONTROL DE CALIDAD (unidad):» se reemplazan por
  «CANTIDAD MUESTREADA (unidad):» con tipo de dato **MuestraCC** y **Estado CC
  marcado** (181 de 187 en los autorizados recientes).
- LIMA: «SET UP (DESPEJE Y LIMPIEZA DE EQUIPOS Y SALA)» pasa a «SET UP (POST -
  PROCESO)». ATE mantiene el primero en Acondicionado y Envase.

Configuración que cambió con el mismo paso:

- «ENTREGAR LA DOCUMENTACION ORDENADA Y FIRMADA AL JEFE O SUPERVISOR DE
  SECCION.»: en LIMA queda **Sin tipo de dato**; en ATE hay de los dos (56 sin
  tipo, 26 con R. Por). CONSULTA cuál es el criterio en ATE.
- «CONDICIONES AMBIENTALES:» dentro de PROCEDIMIENTO: lo normal es **Realizado
  por** (532 de 577); 25 con R. Por + V°B° (cambio pedido en 8 RMD). CONSULTA si
  el V°B° es acuerdo de alguna sección.
- Varias líneas de acondicionado ganaron V°B° (imprimir la primera caja,
  conteo final, cajas por faja transportadora).

## Envase y Acondicionado: pasos comunes entre secciones

Los mismos códigos se usan en muchas secciones de las dos plantas. Lista de los
que están en 9 o más secciones (de 19 en Envase y 18 en Acondicionado):

**Envase** (259 autorizados F2)

| Código | Texto | Tipo | Secciones | RMD |
|---|---|---|---|---|
| 35471 | FECHA / HORA FINAL: | Fecha y Hora | 19 | 256 |
| 109296 | FECHA / HORA FINAL DEL SET UP: | Notificación | 19 | 217 |
| 8160 | CUIDAR SUS IMPLEMENTOS DE TRABAJO Y DE SEGURIDAD PERSONAL. | Múltiple check | 18 | 226 |
| 109518 | EVITAR EL CONTACTO DE LOS INSUMOS O EL GRANEL CON LA PIEL Y LOS OJOS. | Múltiple check | 17 | 219 |
| 60725 | PREPARAR LOS ROTULOS DE IDENTIFICACION DE SALAS Y MAQUINAS … SEGUN POE PPRO-200 VIGENTE. | Múltiple check | 17 | 210 |
| 109157 | FECHA / HORA INICIAL DEL SET UP: | Notificación | 16 | 215 |
| 13680 | FECHA / HORA FINAL DEL ENVASE: | Notificación | 16 | 206 |
| 4644 | CALCULO DE RENDIMIENTO (%) | Fórmula | 16 | 186 |
| 69691 | ENTREGAR LA DOCUMENTACION ORDENADA Y FIRMADA AL JEFE O SUPERVISOR DE SECCION. | Sin tipo | 16 | 175 |
| 109374 | REALIZAR EL DESMONTAJE DE EQUIPOS Y MAQUINAS. | Realizado por | 16 | 164 |
| 109163 | EVITAR EL INGRESO AL AREA DE TRABAJO SI PRESENTA SINTOMAS … SEGUN PPRO-213 VIGENTE. | Múltiple check | 15 | 203 |
| 110695 | VERIFICAR EN LA ETIQUETA DE LIMPIO (FPRO-201 VIGENTE) … | Múltiple check | 15 | 181 |
| 81217 | CONDICIONES AMBIENTALES: | Realizado por | 15 | 165 |
| 13614 | FECHA / HORA INICIO DEL ENVASE: | Notificación | 12 | 156 |
| 139027 | RANGO DE ACEPTACION (95% - 101%) | Sin tipo | 11 | 157 |
| 182341 | NOTA DE LOS VB CON PDOC-207 | Múltiple check | 11 | 36 |
| 129894 | SET UP (POST - PROCESO) | Sin tipo | 9 | 133 |
| 131234 | VERIFICAR QUE EL PRODUCTO A ENVASAR TENGA LA APROBACION CORRESPONDIENTE. | Múltiple check | 9 | 130 |

**Acondicionado** (301 autorizados F2)

| Código | Texto | Tipo | Secciones | RMD |
|---|---|---|---|---|
| 86863 | CALCULO DE RENDIMIENTO (%) | Fórmula | 18 | 291 |
| 69761 | ENTREGAR LA DOCUMENTACION ORDENADA Y FIRMADA AL JEFE O SUPERVISOR DE SECCION. | Sin tipo | 17 | 277 |
| 109409 | FECHA / HORA INICIAL DEL SET UP: | Notificación | 17 | 277 |
| 109411 | FECHA / HORA FINAL DEL SET UP: | Notificación | 17 | 277 |
| 13605 | FECHA / HORA INICIO DE ACONDICIONADO: | Notificación | 17 | 259 |
| 35471 | FECHA / HORA FINAL: | Fecha y Hora | 16 | 243 |
| 8160 | CUIDAR SUS IMPLEMENTOS DE TRABAJO Y DE SEGURIDAD PERSONAL. | Múltiple check | 15 | 256 |
| 51889 | PREPARAR LOS ROTULOS DE IDENTIFICACION DE AREAS Y MAQUINAS … (homologar a SALAS) | Múltiple check | 15 | 202 |
| 80314 | CONDICIONES AMBIENTALES: | Realizado por | 14 | 236 |
| 139027 | RANGO DE ACEPTACION (95% - 101%) | Sin tipo | 12 | 188 |
| 31526 | FECHA / HORA FINAL DE ACONDICIONADO: | Notificación | 11 | 187 |
| 130016 | SET UP (POST - PROCESO) | Sin tipo | 11 | 163 |
| 38375 | UNA VEZ TERMINADO EL ACONDICIONADO DE TODO EL LOTE … CONTEO DE LA CANTIDAD ACONDICIONADA. | Realizado por | 10 | 169 |
| 110611 | REALIZAR EL DESPEJE DE LA LINEA, SEGUN IPRO-P212 VIGENTE. | R. Por + V°B° | 10 | 154 |
| 145335 | PARA LA DISTRIBUCION DE LAS CAJAS DE EMBALAJE EN LA PLATAFORMA … | Realizado por | 10 | 152 |
| 112822 | ASEGURAR EL DESPEJE DE AREA Y/O LINEA … SEGUN INSTRUCTIVO IPRO-P212 VIGENTE. | Múltiple check | 10 | 149 |
| 17779 | MERMA DE ACONDICIONADO (CJA) (4.5.2 - 4.5.5): | Fórmula | 9 | 180 |
| 134778 | REGISTRAR LA INFORMACION REQUERIDA EN LOS FORMATOS DE INSPECCION EN LINEAS DE PRODUCCION FPRO-250 VIGENTE. | Múltiple check | 9 | 151 |

Notas para elegir código cuando hay varios con el mismo texto:

- El mismo texto existe con muchos códigos (p. ej. «FECHA / HORA FINAL:» tiene
  17 códigos; «CONDICIONES AMBIENTALES:», 11). Usar el más usado en la planta y
  etapa (los de las tablas de arriba), salvo que el paso esté enlazado a una
  fórmula o predecesor que dependa del código.
- «CONTROLAR QUE SUS COMPAÑEROS REALICEN LO MISMO.»: ATE usa **62221**; LIMA usa
  **166452** (también 180998 y 62109). Todos reemplazan al 31840 («hagan»).
- Nota de los VB con PDOC-207: **182341** en las dos plantas.

## Consultas abiertas

- ATE: ¿«ENTREGAR LA DOCUMENTACION ORDENADA…» va sin tipo de dato (como LIMA) o
  con Realizado por?
- ¿El V°B° en «CONDICIONES AMBIENTALES:» es acuerdo de alguna sección o queda
  solo Realizado por?
- LIMA usa a veces «PROCEDIMIENTO PPRO-200» y otras «POE PPRO-200». ¿Cuál se
  toma como único?
- «VERIFICAR QUE EL GRANEL TENGA LA APROBACION DE CONTROL DE CALIDAD»: en LIMA
  se dejó «… O CALIDAD EN OPERACIONES, SEGUN APLIQUE» y en ATE se quitó todo lo
  que seguía a «CONTROL DE CALIDAD». ¿Se unifica?

## Cómo se rehace este análisis

Con el Chrome de pruebas abierto en «Configuración Manufactura Digital»:
maestro con `leer_maestro_portal` (fase sacada de la 1.ª línea de
Observaciones; las versiones se enlazan por `codigoversionprincipal`), pasos
con `MD_ES_PASO?$filter=mdId_mdId eq '<id>'&$expand=pasoId,estructuraId,tipoDatoId`
y comparación por código de paso dentro de cada estructura (pareja viejo/nuevo
cuando el texto se parece en 60 % o más).
