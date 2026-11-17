// Núcleo del asistente de configuraciones: lo usan el chat web (api/chatbot.js) y WhatsApp (api/whatsapp.js).
//
// La conversación se guarda completa en Supabase (tabla chatbot_conversaciones) y SOLO se le agregan mensajes al
// final: nunca se reescribe el historial (así lo exige el modelo para sus bloques de razonamiento y así se aprovecha
// la caché). Si cambian las instrucciones o la base de conocimiento (nuevo despliegue), la conversación se reinicia
// con un resumen en texto de lo anterior.
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { INSTRUCCIONES } from './prompt.js';
import { sb, enc } from './supabase.js';
import { ACCIONES_AUTOMATICAS, registrarSolicitud, verMisSolicitudes } from './solicitudes.js';

// Haiku por defecto: entiende bien preguntas cortas con la base de conocimiento y cuesta una fracción de centavo por mensaje.
const MODELO = process.env.CHATBOT_MODELO || 'claude-haiku-5-5';
// El respaldo del servidor ante rechazos existe para Opus/Fable/Sonnet 5.5, no para Haiku.
const CON_RESPALDO = !MODELO.startsWith('claude-haiku');
const ESFUERZO = process.env.CHATBOT_ESFUERZO || 'medium';
const HUELLA = crypto.createHash('sha256').update(INSTRUCCIONES).digest('hex').slice(0, 16);
const MAX_VUELTAS = 6;

const SISTEMA = [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }];


const HERRAMIENTAS = [
  {
    name: 'registrar_solicitud',
    description:
      'Registra una solicitud para Documentación Técnica: un cambio de configuración en un RMD, una consulta que no se puede ' +
      'resolver con la base de conocimiento o una incidencia del portal. Úsala solo después de que la persona confirme el ' +
      'resumen. Para habilitar un paso usa la acción cambiar_predecesor; para decimales, configurar_decimal. Cualquier otro ' +
      'cambio va con cambios vacío y el pedido escrito en detalle.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['cambio', 'consulta', 'incidencia'] },
        prioridad: { type: 'string', enum: ['normal', 'alta'], description: 'alta si hay una OP o lote detenido.' },
        resumen: { type: 'string', description: 'Una línea, en mayúsculas no hace falta.' },
        rmd: { type: 'string', description: 'Código del RMD (10 dígitos) si lo dieron; si no, material + etapa.' },
        material: { type: 'string', description: 'Código del material: con la etapa basta para ubicar el RMD (el lote se confirma en Ver OP).' },
        producto: { type: 'string' },
        etapa: { type: 'string', enum: ['FABRICACION', 'ENVASE', 'ACONDICIONADO', 'RECUBRIMIENTO', 'INSPECCION'] },
        planta: { type: 'string', description: 'ATE (Planta 1) o LIMA (Planta 2).' },
        op_lote: { type: 'string', description: 'OP o lote afectado, si lo dijeron.' },
        detalle: { type: 'string', description: 'Qué pidió la persona y lo que se sabe, en sus palabras y traducido a SAP.' },
        cambios: {
          type: 'array',
          description: 'Cambios exactos que el sistema puede aplicar solo. Vacío si no aplica.',
          items: {
            type: 'object',
            properties: {
              accion: { type: 'string', enum: ACCIONES_AUTOMATICAS },
              lista: {
                type: 'string',
                description: 'Estructura y etiqueta separadas por ">", p. ej. "PROCEDIMIENTO>FABRICACION" o "NOTAS IMPORTANTES DURANTE EL PROCESO".',
              },
              paso: { type: 'string', description: 'Texto del paso (o parte inequívoca) o su código de paso.' },
              orden_paso: { type: 'integer', description: 'Orden del paso en su lista, si se conoce.' },
              predecesor: { type: 'string', description: 'cambiar_predecesor: texto o código del nuevo predecesor.' },
              predecesor_orden: { type: 'integer', description: 'cambiar_predecesor: orden del nuevo predecesor, si se conoce.' },
              sin_predecesor: { type: 'boolean', description: 'cambiar_predecesor: true para dejar el paso sin predecesor.' },
              decimal: { type: 'integer', minimum: 0, maximum: 6, description: 'configurar_decimal: cantidad de decimales.' },
            },
            required: ['accion', 'lista', 'paso'],
          },
        },
      },
      required: ['tipo', 'prioridad', 'resumen', 'detalle'],
    },
  },
  {
    name: 'ver_mis_solicitudes',
    description: 'Muestra el estado de las últimas solicitudes de esta persona (cuando pregunta «¿ya está?», «¿cómo va mi pedido?»).',
    input_schema: { type: 'object', properties: {} },
  },
];

let cliente;
function claude() {
  cliente ??= new Anthropic(); // ANTHROPIC_API_KEY en las variables de entorno
  return cliente;
}

// ---------- conversación ----------
function textoDeConversacion(mensajes) {
  const partes = [];
  for (const m of mensajes) {
    const bloques = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    for (const b of bloques) if (b.type === 'text' && b.text) partes.push(`${m.role === 'user' ? 'Persona' : 'Asistente'}: ${b.text}`);
  }
  return partes.join('\n');
}

async function cargarConversacion(contacto) {
  const filas = await sb(`chatbot_conversaciones?contacto=eq.${enc(contacto)}&select=*`);
  const c = filas[0];
  if (!c) return { mensajes: [] };
  const vieja = Date.now() - new Date(c.actualizado).getTime() > 12 * 3600 * 1000;
  if (vieja) return { mensajes: [] }; // tras 12 h sin hablar se empieza de cero
  if (c.huella !== HUELLA) {
    // Cambiaron las instrucciones: se arranca una conversación nueva con lo anterior como texto.
    const previo = textoDeConversacion(c.mensajes || []).slice(-4000);
    return { mensajes: [], previo };
  }
  return { mensajes: c.mensajes || [] };
}

async function guardarConversacion(contacto, mensajes) {
  await sb('chatbot_conversaciones', {
    method: 'POST',
    body: { contacto, huella: HUELLA, mensajes, actualizado: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates',
  });
}

export async function reiniciarConversacion(contacto) {
  await sb(`chatbot_conversaciones?contacto=eq.${enc(contacto)}`, { method: 'DELETE' });
}

/**
 * Atiende un mensaje.
 * @param {{canal:'web'|'whatsapp', contacto:string, nombre?:string, area?:string}} quien
 * @param {string} texto
 * @returns {Promise<{texto:string, solicitudes:object[]}>}
 */
export async function atender(quien, texto) {
  const { mensajes, previo } = await cargarConversacion(quien.contacto);
  const encabezado = mensajes.length === 0 && (quien.nombre || quien.area)
    ? `[Me escribe ${quien.nombre || 'alguien'}${quien.area ? ` de ${quien.area}` : ''}]\n`
    : '';
  const contexto = previo ? `[Conversación anterior, como referencia:\n${previo}]\n\n` : '';
  mensajes.push({ role: 'user', content: contexto + encabezado + texto });

  const solicitudes = [];
  let respuesta;
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const peticion = {
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      tools: HERRAMIENTAS,
      thinking: { type: 'adaptive' },
      output_config: { effort: ESFUERZO },
      messages: mensajes,
    };
    respuesta = CON_RESPALDO
      ? await claude().beta.messages.create({ ...peticion, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await claude().messages.create(peticion);
    mensajes.push({ role: 'assistant', content: respuesta.content });
    if (respuesta.stop_reason !== 'tool_use') break;

    const resultados = [];
    for (const b of respuesta.content) {
      if (b.type !== 'tool_use') continue;
      try {
        if (b.name === 'registrar_solicitud') {
          const r = await registrarSolicitud(b.input || {}, quien, textoDeConversacion(mensajes));
          solicitudes.push(r.solicitud);
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: r.texto });
        } else if (b.name === 'ver_mis_solicitudes') {
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: await verMisSolicitudes(quien) });
        } else {
          resultados.push({ type: 'tool_result', tool_use_id: b.id, content: 'Herramienta desconocida.', is_error: true });
        }
      } catch (e) {
        resultados.push({ type: 'tool_result', tool_use_id: b.id, content: `No se pudo: ${e.message}`, is_error: true });
      }
    }
    mensajes.push({ role: 'user', content: resultados });
  }

  let salida = (respuesta?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (respuesta?.stop_reason === 'refusal' || !salida) {
    salida = 'No pude responder eso. Si es sobre la configuración de un RMD, cuéntame el código del RMD y qué necesitas, o te paso con el analista.';
  }
  await guardarConversacion(quien.contacto, mensajes);
  return { texto: salida, solicitudes };
}
