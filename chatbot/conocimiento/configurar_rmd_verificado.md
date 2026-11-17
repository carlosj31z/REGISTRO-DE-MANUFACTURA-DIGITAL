# "Configurar el RMD" — mapa verificado en el sistema real

Exploración hecha sobre un RMD de prueba (código 2202609089, "RMD PRUEBA") con la sesión
iniciada por el usuario. Todo está dentro del iframe `ui5appruntime.html`.

## Menú "Acción" de la fila (MenuButton dividido: "Abrir menú")

| Opción | Diálogo que abre |
|---|---|
| Ver master | PDF del máster (no abierto en detalle) |
| Descargar master | descarga del PDF (no ejecutado) |
| Agregar Documento | "Agregar Documentos al RMD: …": `<input type=file>` ("Examinar…"), Guardar / Cerrar |
| Ver OP | "Visualizar las Ordenes de Producción Asociadas al RMD": filtros OP y Lote, Search, tabla, Cerrar |
| Asociar fórmulas | "Asociar Fórmula: …" (Código Agrupador, Descripción, Código, Fecha Solicitud, Rpt. Validación, Etapa, Area, switch "(+) recetas", Planta, Estado, Motivo de Solicitud, RM Digital Paralelo, Observaciones; tabla "Recetas Asociadas (n)"; botones Actualizar, Agregar Producto, Guardar, Cancelar). "Agregar Producto" abre "Asociar Recetas al RM" (Código, Descripción, Variante + Ir, tabla, Agregar / Cancelar) |
| Configurar el RMD | Editor "<código> - <descripción>" (abajo) |
| Trazabilidad RMD | "Trazabilidad del RMD": Estado, Registrado, Usuario Registro, Cerrar |
| Notas Importantes | "Ver Notas Importantes RMD": tabla Nombre Creador/Descripción; "Agregar Nota Importante" -> "Ingresar Nota Importante" (textarea, Confirmar / Cancelar; se guarda sin confirmación) |

## Editor "Configurar el RMD"

Encabezado de solo lectura: Código Web, Descripción, Etapa, Planta, Estado del RMD.
Tabla "Estructura de RMD (n)": Orden, Descripción, Código, Items, Repite, Num., Acc.

Barra (tooltips): Comparar versiones, Nueva Versión, Copiar a RMD, Copiar de RMD, Imprimir,
Exportar Configuración, Generar Predecesores, Actualizar RMD en Línea, Configuración Inicial,
"+" (Agregar Estructura). No hay "Guardar" ni "Confirmar": el pie solo tiene "Cerrar".

| Botón | Comportamiento verificado |
|---|---|
| Comparar versiones | Selector (título engañoso "Adicionar Estructura al RMD"): Campo (combo), Buscar, Restablecer, Ir, tabla de RMD con "+" por fila; botones Comparar, Flujo de Aprobación, Cancelar |
| Nueva Versión | Advertencia "¿Desea generar una nueva versión?" [OK]/[Cancelar] |
| Copiar a RMD | "Copiar Información del RMD": Descripción RMD, Cod. defecto, Etapa y Estado (solo lectura), Planta, Motivo de Solicitud, Fecha Solicitud, Observacion; Confirmar / Cancelar |
| Copiar de RMD | "Copiar De: …": Código RMD, Descripción, Etapa (fija), Planta + Ir; tabla de ~3.000 RMD con casillas; Confirmar / Cancelar |
| Imprimir / Exportar Configuración | No producen diálogo visible (descarga / pestaña; no ejecutado) |
| Generar Predecesores | Advertencia "¿Desea generar Predecesores?" [OK]; éxito tardío "Se generaron los predecesores correctamente." [OK] |
| Actualizar RMD en Línea | Sin OP asociada: "No se puede actualizar en linea porque no hay una OP asociada." [OK] |
| Configuración Inicial | Advertencia "¿Desea realizar la configuracion inicial del RMD?" [OK]/[Cancelar] |
| "+" Agregar Estructura | Selector con Buscar/Ir y casillas; confirmación "¿Desea asignar las estructuras seleccionadas?" (manual) |

### Iconos por fila de estructura (según el tipo)

- **Adicionar Pasos RMD** (Precauciones, Notas importantes, Condiciones ambientales): abre "Pasos (n)".
- **Adicionar Etiqueta** (Procedimiento): abre "Etiqueta (n)".
- **Adicionar Equipo** (Equipos/Instrumentos/Materiales): abre "Equipos (n)".
- **Adicionar Especificaciones** (Especificaciones de producto en proceso): abre "Especificaciones (n)".
- **Eliminar Estructura**: siempre.

### Equipos (n)

Tabla Orden, Código, Descripción, Estado, Área, Tipo (EQUIPO / ACCESORIO / AGRUPADOR), Código
de referencia; botones Imprimir, "+" (Adicionar Equipo), Eliminar (casillas), Cancelar.
Selector "Adicionar Equipos: EQUIPOS": filtros Cod. Equipo, Descripción, Cod. GACI, Estado, Área
+ Ir; "+" = Agregar Agrupador; Actualizar; casillas; Agregar / Cancelar.
Flujo real probado: casilla -> Agregar -> **"Confirmación: ¿Desea asignar los equipos o
utensilios seleccionadas?" [OK]** -> **"Éxito: Se asignó exitosamente los equipos o utensilios a
la estructura." [OK]** (se cierra el selector y el contador sube). Eliminar -> casilla ->
"Eliminar" -> **"¿Desea proceder con la eliminación del registro seleccionado?" [Borrar]** ->
**"Éxito: Se eliminaron los registros correctamente" [OK]** (aparece unos segundos después).

### Especificaciones (n)

Tabla Descripción, Especificaciones, Tipo Dato (combo), Valor Inicial/Final, Margen, Decimal;
botones "Ensayos SAP" (actualizar), Imprimir, "+" Agregar, Guardar, Eliminar, Cancelar. "+" abre
"Adicionar Especificaciones": Ensayo Padre (combo), Ensayo Hijo, Especificaciones, Tipo Dato
(combo), Valores (Mínimo, Máximo, Margen), Decimales; Agregar / Cancelar.

### Etiqueta (n)

Tabla Orden, Código, Descripción, Items, Conforme (checkbox), Proceso Menor (checkbox), Acciones
(lápiz = Adicionar Pasos RMD). Botones Imprimir, "+" (tooltip "Etiqueta"), Guardar, Eliminar,
Cancelar. "+" abre "Adicionar Etiquetas: <ESTRUCTURA>" (Buscar + Ir, casillas, Agregar/Cancelar).

### Pasos (n)

Columnas: Orden, Depende (con ayuda de entradas), Código, Descripción, Tipo Dato, Clave Modelo,
Puesto Trabajo, Val. Inicial, Val. Final, Margen, Decimal, Estado CC, Estado Mov., PM OP, Gen PP,
Edit, R. Por, V.B., Imagen, Formato, Proc. Men., Estado. Botones de fila: **Imagen**, **Formato**,
**Procesos Menores**. Barra: Imprimir, "+" (tooltip "Agregar" o "Agregar Estructura"), Guardar,
Eliminar, Cancelar.

- "+" abre "Adicionar Pasos": Código Paso, Descripción, Estructura, Etiqueta, Flag Numeración + Ir;
  tabla (Código, Descripción, Estado, Num., Estructura, Etiqueta) con casillas; Agregar / Cancelar.
- **Guardar** -> "Éxito: Se guardaron correctamente los cambios." [OK] (sin confirmación previa).
- Clic en el **código del paso** abre "Editar Paso" (edita el paso **maestro**, no solo este RMD):
  Código Paso, Estructura, Etiqueta, Descripción Paso, Flag Numeración, Tipo de Dato (RMD en
  Linea), Clave Modelo, automatico, Valores (Mín/Máx/Margen), Decimales, Lapso; Grabar / Cancelar.
  ¡Cuidado al automatizar clics sobre esa columna!
- **Formato**: selector de color (Hex, R, G, B, A; Confirmar / Cancelar).
- **Imagen**: "Seleccione una imagen" (archivo, Posición Arriba/Derecha/Abajo, Tamaño 10–130).

### Procesos Menores

"Procesos Menores para el Paso: <cod> (<desc>)", tabla "Procesos (n)": Orden, Código,
Descripción, Cantidad Insumos, UM, Tab, Edit, Tipo Dato, Val. Inicial/Final, Margen, Decim.,
Gen PP, Estado CC, Estado Mov., Formato, Estado. Barra: Imprimir, "+" (tooltip "Adicionar Pasos
RMD" -> selector "Adicionar Pasos"), "Agregar Insumo" (abre "Adicionar Pasos": Código,
Descripción, UM, Cantidad; vacío si no hay insumos), Guardar, Eliminar, Cerrar.

## Notas de automatización

- Los clics por coordenadas del navegador integrado son poco fiables (el tamaño de la vista
  cambia); para exploración se usó `sap.ui.getCore().byId(...).firePress()` dentro del iframe.
  En Playwright los clics por rol/nombre no tienen ese problema.
- Los avisos de éxito pueden tardar (Generar Predecesores, Eliminar): esperar hasta ~15 s.
- Un clic en el cuerpo de una fila de la tabla principal abre "Editar RM" (no el envío).

## Segunda pasada: escritura real sobre el RMD de prueba

Se añadieron a "RMD PRUEBA" pasos que ya existían en el catálogo (sin crear pasos maestros nuevos)
y se configuró su tipo de dato; todo se comprobó cerrando y reabriendo el diálogo.

- **Asignar pasos**: casillas -> Agregar -> "Confirmación: ¿Desea asignar los pasos seleccionadas?." [OK]
  -> "Éxito: Se asignó exitosamente los pasos a la estructura." [OK]. Los pasos nuevos entran con
  Tipo Dato "Sin tipo de dato" y sin "Depende".
- **Lista real de Tipo Dato** (ComboBox): Verificación Check, Texto, Cantidad, Fecha, Fecha y Hora, Hora,
  Números, Realizado por, Visto bueno, Realizado por y Visto bueno, Múltiple check, Rango, Lote,
  Fórmula, Sin tipo de dato, Notificacion (sin tilde), MuestraCC, Fecha Vencimiento, Entrega.
- **Guardar exige "Decimal"**: sin él -> "Advertencia: Por favor complete los campos obligatorios"
  (aunque el tipo sea Entrega o Sin tipo de dato; los pasos existentes usan Decimal 3, o 0).
- Configuraciones aplicadas y persistidas:
  - Precauciones / Notas importantes -> Verificación Check.
  - Condiciones ambientales: temperatura 15–30 y humedad 25–45 -> Rango (Val. Inicial/Final, Margen 0, Decimal 1).
  - Documentación: verificaciones -> Múltiple check; fecha/hora final -> Notificacion, Clave Modelo
    "Setup Post Proceso", Puesto Trabajo FSOLFA02 (opciones útiles de Clave Modelo: Setup Pre Proceso,
    Proceso, Setup Post Proceso).
  - Fabricación: "pH: (1.50 - 3.50)" -> Rango 1.5–3.5; "DETERMINAR EL pH…" -> Números (Decimal 2, Edit).
  - Rendimiento: "CANTIDAD ENTREGADA (TAB)" -> Entrega (Edit); "CANTIDAD OBTENIDA…" -> Fórmula.
- **Fórmula**: el botón "Fórmula" de la fila aparece solo después de guardar. Abre "Fórmulas" (Pasos
  Disponibles / seleccionados con radios; "Mover a seleccionados", "Mover a disponibles"). Guardar ->
  "Confirmación: ¿Desea guardar la fórmula generada?." [OK] -> "Éxito: Se grabó la fórmula exitosamente." [OK].
- **Proceso menor**: en "Procesos Menores para el Paso" el "+" asigna con la misma confirmación/éxito.
  "Agregar Insumo" sigue vacío: los insumos salen de las recetas asociadas (Asociar fórmulas).
- **Nueva Versión**: tras el OK no hay aviso; el editor se cierra solo (~10 s) y aparece un RMD nuevo
  (2202609090, versión 2, Ingresado) con toda la configuración copiada (los conteos de items coinciden).
- **Configuración Inicial**: tras el OK no se observó ningún aviso de éxito en ~15 s (el manual menciona uno).
- Selector de pasos: los combos Estructura/Etiqueta del filtro son poco fiables (Estructura=PROCEDIMIENTO +
  Etiqueta=DOCUMENTACION devolvió 0); buscar por Descripción funciona bien.

## Tercera pasada: quitar pasos y reparar predecesores (RMD de prueba 2202609091)

- **Eliminar pasos**: casilla de la fila -> "Eliminar" -> "Confirmación: ¿Desea proceder con la eliminación del
  registro seleccionado?" [Borrar] -> "Éxito: Se eliminaron los registros correctamente" [OK]. El diálogo
  "Pasos (n)" sigue abierto con un paso menos.
- **Efecto colateral**: el paso que dependía del eliminado conserva su "Depende" como referencia colgante
  (`118560` sin `(orden)`). Se corrige con la Lista de Predecesores (buscar por código, elegir por código y
  orden) y Guardar ("Se guardaron correctamente los cambios."); se comprobó tras cerrar y reabrir.
- **Filas pop-in**: con la vista angosta las tablas de "Pasos (n)" intercalan una fila secundaria
  (`tr.sapMListTblSubRow`) tras cada paso; hay que ignorarlas al contar filas por posición.
