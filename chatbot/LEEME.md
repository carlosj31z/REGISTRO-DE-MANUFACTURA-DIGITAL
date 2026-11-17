# Asistente de configuraciones RMD (chatbot)

Atiende a Producción y Calidad en Operaciones (WhatsApp o el chat web `/chatbot/`). **Por defecto es un bot guiado, sin
IA y gratis** (decisión de Carlos, 2026-11-16): menús numerados y opciones cerradas en cada paso. Trata de usted, con tono
cordial y sin emojis, y entiende saludos y pedidos escritos con palabras comunes («PDF master del lote L2611A») por
palabras clave (2026-11-17).

Menú: 1 habilitar un paso · 2 decimales · 3 plantilla para Producción · 4 PDF del master · 5 estado de un RMD (última
versión y vigente) · 6 consulta para el analista · 7 mis solicitudes · 8 preguntas frecuentes. Las opciones 3 a 5 son de
solo lectura: el ejecutor arma el archivo en SAP, lo sube al bucket privado `chatbot-archivos` de Supabase y responde con
un enlace firmado de 7 días. Solo se escribe el
código del material, el lote, números de orden y, en consultas, una descripción. Los cambios que entiende con seguridad
se aplican solos en SAP con la cuenta del analista; lo demás le llega al analista.

Flujo «habilitar un paso»: ¿tienes el lote? → (sí: lote, **con el lote basta**; no: material → etapa (FABRICACION, ENVASE,
ACONDICIONADO, RECUBRIMIENTO, INSPECCION)) → lista del paso → orden del paso → desde qué paso (misma lista / otra lista /
sin predecesor) → orden → confirmar. Decimales: igual hasta el orden, luego 0 a 4 decimales. **No se pide el código del
RMD**: el ejecutor lo ubica por el lote en «Ver OP» (`/RMD`, `lote`) o, sin lote, por material + etapa (entidad MD,
`codDefectoReceta` + `nivelTxt`, última versión Autorizada). Si no lo puede ubicar sin dudas, la solicitud pasa al analista.

**Chat estilo WhatsApp**: `/chatbot/whatsapp.html` (mismo motor; las opciones numeradas salen como botones; el resultado de
cada solicitud aparece en el chat cuando el ejecutor termina).

**Clave**: el chat funciona sin clave. Sin ella, los cambios y los documentos esperan la aprobación del analista (el estado
del RMD se responde solo). Para que vayan directo, se reparte el enlace `https://status-rmd.vercel.app/chatbot/whatsapp.html#clave=<CHATBOT_CLAVE>`:
la clave queda guardada en ese equipo y se quita de la barra de direcciones. En WhatsApp manda la lista
`CHATBOT_WHATSAPP_PERMITIDOS`.

```
Producción ──WhatsApp──► api/whatsapp.js ─┐
Producción ──web───────► api/chatbot.js ──┼─► api/_chatbot/motor.js → guiado.js (menús, sin IA) | nucleo.js (Claude, opcional)
                                          │        └─► Supabase: chatbot_solicitudes / chatbot_conversaciones
Analista ◄──WhatsApp / bandeja web────────┘        └─► GitHub: workflow «Atender solicitudes del chatbot»
                                                         (AUTOMATIZACION-DE-RMD, `rmd-automation solicitudes atender`)
                                                         entra a SAP con la cuenta del analista, aplica, pulsa
                                                         «Actualizar RMD en Línea», verifica y avisa el resultado.
```

## Qué aplica solo y qué no

- **Solo** (estado `lista`): `cambiar_predecesor` («habilitar el paso»: otro predecesor anterior, o sin predecesor) y
  `configurar_decimal` (columna Decimal de un dato numérico), en RMD **Ingresados o Autorizados** (no cambian palabras).
  El ejecutor lee el RMD, comprueba que el paso y el predecesor existan y sean únicos, que el predecesor sea anterior y no
  «Sin tipo de dato», que la lista lleve predecesores (Rendimiento y Condiciones ambientales no) y que el dato sea numérico;
  si algo no cuadra, no toca nada y la solicitud pasa a `revisar`.
- **Al analista** (estado `nueva`): todo lo demás (pasos nuevos, textos, rangos, versión nueva, dudas sin respuesta, errores).
- **Interruptor**: `CHATBOT_MODO=aprobacion` en Vercel hace que nada se aplique hasta que el analista lo apruebe
  (bandeja web «Aprobar y aplicar» o WhatsApp «aprobar 12»).

## Puesta en marcha

1. **Supabase** (proyecto de status-rmd): ejecutar en el SQL Editor la parte «Asistente de configuraciones» de
   `supabase_tablas.sql` (crea `chatbot_solicitudes`, `chatbot_conversaciones`, `chatbot_mensajes_vistos`).
2. **Vercel** (proyecto status-rmd) → Settings → Environment Variables:

   | Variable | Para qué |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Clave **service_role** de Supabase (Project Settings → API). Obligatoria. Es secreta: solo aquí y en GitHub, nunca en la página. Las tablas del chatbot no aceptan la clave pública. |
   | `CHATBOT_CLAVE_ANALISTA` | Clave para la bandeja del analista y para que el ejecutor avise resultados. Obligatoria. |
   | `CHATBOT_CLAVE` | Clave para usar el chat web. Sin ella, lo que llegue por la web nunca se aplica solo (queda para el analista). |
   | `CHATBOT_MODO` | `automatico` (por defecto) o `aprobacion`. |
   | `CHATBOT_MOTOR` | `guiado` (por defecto, gratis) o `claude` (texto libre con IA: necesita `ANTHROPIC_API_KEY`, de pago). |
   | `ANTHROPIC_API_KEY`, `CHATBOT_MODELO`, `CHATBOT_ESFUERZO` | Solo con `CHATBOT_MOTOR=claude`. Modelo por defecto `claude-haiku-5-5`. |
   | `GITHUB_DISPATCH_TOKEN` | Token de GitHub (fine-grained, repo AUTOMATIZACION-DE-RMD, permiso *Contents: read and write*) para despertar al ejecutor al instante. Sin él, el ejecutor igual pasa cada 15 min. |
   | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Del número de WhatsApp Business (Meta for Developers → WhatsApp → API Setup). |
   | `WHATSAPP_VERIFY_TOKEN` | Texto que inventas y repites en Meta al registrar el webhook. |
   | `WHATSAPP_APP_SECRET` | App Secret de la app de Meta (verifica que los mensajes vengan de Meta). |
   | `CHATBOT_WHATSAPP_ANALISTA` | Número del analista con código de país, solo dígitos (p. ej. 51999888777). |
   | `CHATBOT_WHATSAPP_PERMITIDOS` | Números permitidos separados por comas. Solo las solicitudes de estos números se aplican solas. |

3. **GitHub** (repo AUTOMATIZACION-DE-RMD) → Settings → Secrets and variables → Actions: `RMD_USERNAME` y
   `RMD_PASSWORD` (cuenta del analista en el portal), `SUPABASE_SERVICE_ROLE_KEY`, `CHATBOT_URL` (`https://status-rmd.vercel.app`)
   y `CHATBOT_CLAVE_ANALISTA`. Luego Actions → «Atender solicitudes del chatbot» → Run workflow con «Solo probar el inicio
   de sesión» marcado: si dice `#login → ok`, el ejecutor ya puede entrar a SAP desde la nube.
4. **WhatsApp**: en Meta for Developers, webhook = `https://status-rmd.vercel.app/api/whatsapp`, token de verificación =
   `WHATSAPP_VERIFY_TOKEN`, suscribir el campo `messages`. Probablemente haga falta el visto bueno de TI (número y cuenta de
   empresa verificada).

## Comandos del analista por WhatsApp

`pendientes` · `aprobar 12` · `rechazar 12 motivo` · `responder 12 texto` · `resuelta 12`.
Producción puede escribir `reiniciar` para empezar una conversación nueva.

## Cambiar lo que sabe

Bot guiado: menús, listas y preguntas frecuentes en `api/_chatbot/guiado.js`. Motor con Claude: la base es `chatbot/conocimiento/*.md`; `jerga_y_reglas.md` manda sobre las guías. Tras editar:
`node herramientas/chatbot/construir_conocimiento.mjs` (con `--desde ../AUTOMATIZACION-DE-RMD` copia antes las guías al día)
y subir el cambio. Las conversaciones en curso se reinician solas con un resumen.

## Probar sin claves ni WhatsApp

- `npm install`, `node herramientas/chatbot/probar_guiado.mjs` (bot guiado de punta a punta, todo simulado) y
  `node herramientas/chatbot/probar.mjs` (el motor opcional con Claude, guionado).
- `node herramientas/chatbot/servidor_local.mjs --simulado` y abrir `http://localhost:3000/chatbot/` (bandeja: clave `analista`).
- Sin `--simulado` usa las claves reales de las variables de entorno.
