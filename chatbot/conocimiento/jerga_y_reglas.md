# Jerga de Producción y reglas firmes de Documentación Técnica

Este archivo lo mantiene Documentación Técnica (Carlos). Es lo primero que el asistente debe respetar: si algo de las
guías técnicas contradice este archivo, manda este archivo. Para cambiar cómo responde el asistente, se edita aquí y se
vuelve a construir la base (`node herramientas/chatbot/construir_conocimiento.mjs`).

## Glosario

- **RMD**: Registro de Manufactura Digital (portal SAP Fiori «Configuración RMD»). Cada versión de un RMD tiene su
  propio código (p. ej. 2202609090). Un master tiene varias versiones; la **vigente** es la última **Autorizada**.
- **Estados**: Ingresado (en edición, todavía no aprobado), Autorizado (vigente), Suspendido. INACTIVO aún no existe en SAP.
- **Planta 1** = ATE, **Planta 2** = LIMA.
- **Etapas**: Fabricación, Envase, Acondicionado, Recubrimiento, etc. **Estructuras** del RMD: Precauciones, Notas
  importantes, Equipos/Instrumentos/Materiales, Insumos, Condiciones ambientales, Procedimiento, Especificaciones,
  Verificación de firmas. Dentro del Procedimiento hay **etiquetas** (Documentación, Preparación del material,
  Preparación de máquinas, la etapa principal, Rendimiento).
- **Paso** (o paso mayor): una línea del procedimiento. **Proceso menor**: línea de captura debajo de un paso.
- **Depende / predecesor**: el paso que tiene que estar registrado antes para que este se pueda registrar.
- **CC** = Control de Cambios (p. ej. 26-275). **NC** = No conformidad. **ASC** = Aseguramiento de la Calidad.
- **DOC** / **Documentación Técnica**: el área que configura los RMD en SAP. El **analista de Documentación Técnica**
  es quien recibe las solicitudes del asistente.
- **Calidad en Operaciones**: el área de Calidad que muestrea e inspecciona en planta (antes «Control de Calidad»).
- **OP**: Orden de Producción. Al asociar una OP, la OP guarda **su propia copia** del RMD.

## Cómo traducir lo que pide Producción

### «Habilitar el paso» (o «que se habilite», «que me deje registrar el paso», «está bloqueado»)
Significa que el paso **no se puede registrar porque su predecesor (Depende) todavía no está registrado**, y Producción
quiere poder registrarlo antes. La solución es **cambiar el predecesor del paso a un paso anterior** que ya se registra
en ese momento del proceso (normalmente uno mucho más antes, no el inmediato anterior: p. ej. la notificación de
inicio, o el paso donde realmente empieza esa operación en paralelo). **En casos extremos**, cuando el paso es
realmente independiente (condicional «EN CASO QUE…», «PARALELAMENTE…», «EN PARALELO…», «BAJO LA SUPERVISION…»), se le
**quita el predecesor** (queda sin Depende).

Qué hay que preguntar para armar la solicitud: código del RMD (o producto, etapa y planta), número y texto del paso que
quieren habilitar, desde qué paso debería poder registrarse (o si debe quedar libre), y si hay una OP en curso que lo
necesita (número de OP / lote).

Cómo se hace en SAP (lo ejecuta DOC): Configurar el RMD → icono de pasos de la etiqueta → «Pasos (n)» → en la celda
**Depende** del paso, «Mostrar ayuda para entradas» → «Lista de Predecesores» → elegir el nuevo predecesor **por código
y orden** (un mismo código puede repetirse) o vaciar el campo para dejarlo sin predecesor → **Guardar**.

Cuidados que el asistente debe mencionar cuando apliquen:
- Solo se admite **un** predecesor por paso.
- Marcar la casilla **Estado CC** vacía el Depende de esa fila: el predecesor se asigna después.
- Los pasos «Sin tipo de dato» no llevan predecesor ni sirven de predecesor. Condiciones ambientales y Rendimiento no llevan.
- Todo otro paso con tipo de dato debe llevar predecesor salvo que sea condicional o en paralelo por su redacción:
  quitarlo es la excepción, no la regla, y DOC tiene que verlo.
- Cambiar el predecesor no cambia ninguna palabra del paso, así que se hace sobre el mismo RMD, también si está
  Autorizado (no requiere versión nueva).
- La OP que está en proceso tiene su propia copia del RMD: después de **Guardar** hay que pulsar **«Actualizar RMD en
  Línea»** (barra del editor «Configurar el RMD») para que el cambio llegue al RMD en proceso. Si no hay OP asociada, el
  portal responde «No se puede actualizar en linea porque no hay una OP asociada.» y basta con lo guardado.

### «Configurar los decimales» (o «que acepte decimales», «que me deje poner 2 decimales», «me redondea»)
Es cambiar la columna **Decimal** de un paso (o proceso menor) cuyo Tipo de Dato es **Números** (también aplica a Rango,
Fórmula, Entrega, MuestraCC). Preguntar: RMD, paso (o proceso menor) y **cuántos decimales** necesitan, y la unidad
(kg, g, mL, unidades…).
- Valores habituales: Fórmula/Entrega/MuestraCC/Números 3; 0 cuando la unidad es entera (cajas, folios, unidades);
  velocidad/temperatura de proceso 1; Sin tipo de dato 0. Decimal es obligatorio para guardar.
- Se cambia en la tabla «Pasos (n)» (columna Decimal) o en «Procesos Menores» (columna Decim.) **del RMD** y Guardar.
- **No** se cambia desde «Editar Paso» (clic en el código del paso): eso edita el **paso maestro** y afecta a **todos** los
  RMD que lo usan.
- Como no cambia palabras del paso, se hace sobre el mismo RMD (también Autorizado). Después de Guardar se pulsa
  «Actualizar RMD en Línea» para que llegue a la OP en proceso.

### Otros pedidos frecuentes
- **«Agregar un paso» / «falta un paso»**: se agrega un paso que ya existe en el catálogo; crear un paso maestro nuevo
  es la excepción (afecta a todos los RMD). Hay que saber qué anota el paso (Tipo de Dato) y dónde va.
- **«Que firme el jefe» / «que pida visto bueno»**: Tipo de Dato «Visto bueno» o «Realizado por y Visto bueno» (casilla V.B.).
- **«Cambiar el rango» / «el rango está mal»**: Tipo Rango, Val. Inicial / Val. Final / Margen. Si el rango viene de una
  especificación o un documento, lo confirma Calidad / DOC.
- **«Cambiar el texto del paso»**: la homologación se hace **cambiando el paso por el código vigente del maestro**, no
  editando el texto. Va a DOC.
- **«La cantidad del insumo está mal»**: la cantidad de la **receta** no se cambia en el RMD (se corrige en la Lista de
  Materiales de SAP); la cantidad de un insumo **dentro de un paso del Procedimiento** sí se cambia en el RMD.
- **«Cambio de material»**: se hace en la misma versión (no se crea versión nueva).

## Reglas firmes (no se negocian)

1. **El asistente no escribe en SAP.** Solo explica y registra solicitudes. Todo cambio lo aprueba y ejecuta
   Documentación Técnica.
2. En un RMD **Autorizado** no se edita ninguna palabra de pasos ni de procesos menores: un cambio de texto, pasos
   nuevos o quitados va en una **versión nueva** (que luego se vuelve a autorizar). Predecesores y decimales sí se
   ajustan en el mismo RMD.
2b. Todo cambio de configuración que deba llegar a una OP en proceso termina con **Guardar** y luego **«Actualizar RMD
   en Línea»**.
3. Los textos de los pasos van **en mayúsculas y sin tildes**.
4. La fase de una versión nueva no se copia sola: se elige (salvo Cambio de material).
5. Se usa siempre «CALIDAD EN OPERACIONES», no «CONTROL DE CALIDAD» (excepciones: biocarga, la nota del granel y el
   cierre de Acondicionado con FPRO-250, que ya están aprobados así).
6. La casilla **PM OP** no se marca en ningún paso.
7. No se crean pasos maestros nuevos si existe uno en el catálogo.
8. Ningún dato se inventa: si no se sabe el RMD, el paso o el valor, se pregunta. Si la duda no está en las guías, se
   escala al analista.

## Cuándo escalar al analista de Documentación Técnica

Siempre que haya que **cambiar algo** en un RMD (habilitar paso, decimales, rangos, pasos, textos, versión nueva, etc.)
y siempre que el asistente **no pueda resolver** la consulta con estas guías, o que Producción reporte un error del
portal, una OP detenida o algo que afecte a un lote en curso (eso va con prioridad alta).
