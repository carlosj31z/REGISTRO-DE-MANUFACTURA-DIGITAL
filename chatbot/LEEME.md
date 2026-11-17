# Asistente de configuraciones RMD (chatbot)

Atiende a Producción y Calidad en Operaciones (WhatsApp o el chat web `/chatbot/`). **Por defecto es un bot guiado, sin
IA y gratis** (decisión de Carlos, 2026-11-16): menús numerados y opciones cerradas en cada paso. Solo se escribe el
código del material, el lote, números de orden y, en consultas, una descripción. Los cambios que entiende con seguridad
se aplican solos en SAP con la cuenta del analista; lo demás le llega al analista.

Flujo «habilitar un paso»: material → etapa (FABRICACION, ENVASE, ACONDICIONADO, RECUBRIMIENTO, INSPECCION) → ¿lote en
proceso? → lista del paso → orden del paso → desde qué paso (misma lista / otra lista / sin predecesor) → orden → confirmar.
Decimales: igual hasta el orden, luego 0 a 4 decimales. **No se pide el código del RMD**: el ejecutor lo ubica con material +
etapa (entidad MD, `codDefectoReceta` + `nivelTxt`) y, si dieron lote, toma el RMD cuya «Ver OP» tiene ese lote; sin lote,
la última versión Autorizada. Si no lo puede ubicar sin dudas, la solicitud pasa al analista.

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
   | `SUPABASE_ANON_KEY` | La clave pública de Supabase que ya usa index.html. Obligatoria. |
   | `CHATBOT_CLAVE_ANALISTA` | Clave para la bandeja del analista y para que el ejecutor avise resultados. Obligatoria. |
   | `CHATBOT_CLAVE` | Opcional: clave para usar el chat web (si no se pone, el chat web queda abierto). |
   | `CHATBOT_MODO` | `automatico` (por defecto) o `aprobacion`. |
   | `CHATBOT_MOTOR` | `guiado` (por defecto, gratis) o `claude` (texto libre con IA: necesita `ANTHROPIC_API_KEY`, de pago). |
   | `ANTHROPIC_API_KEY`, `CHATBOT_MODELO`, `CHATBOT_ESFUERZO` | Solo con `CHATBOT_MOTOR=claude`. Modelo por defecto `claude-haiku-5-5`. |
   | `GITHUB_DISPATCH_TOKEN` | Token de GitHub (fine-grained, repo AUTOMATIZACION-DE-RMD, permiso *Contents: read and write*) para despertar al ejecutor al instante. Sin él, el ejecutor igual pasa cada 15 min. |
   | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Del número de WhatsApp Business (Meta for Developers → WhatsApp → API Setup). |
   | `WHATSAPP_VERIFY_TOKEN` | Texto que inventas y repites en Meta al registrar el webhook. |
   | `WHATSAPP_APP_SECRET` | App Secret de la app de Meta (verifica que los mensajes vengan de Meta). |
   | `CHATBOT_WHATSAPP_ANALISTA` | Número del analista con código de país, solo dígitos (p. ej. 51999888777). |
   | `CHATBOT_WHATSAPP_PERMITIDOS` | Opcional: números permitidos separados por comas (si no, cualquiera que escriba). |

3. **GitHub** (repo AUTOMATIZACION-DE-RMD) → Settings → Secrets and variables → Actions: `RMD_USERNAME` y
   `RMD_PASSWORD` (cuenta del analista en el portal), `SUPABASE_ANON_KEY`, `CHATBOT_URL` (`https://status-rmd.vercel.app`)
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
