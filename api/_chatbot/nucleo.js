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
import { alRegistrar } from './avisos.js';

const MODELO = process.env.CHATBOT_MODELO || 'claude-opus-5-5';
const ESFUERZO = process.env.CHATBOT_ESFUERZO || 'medium';
// automatico: los cambios completos (habilitar paso / decimales) pasan directo al ejecutor.
// aprobacion: todo espera a que el analista lo apruebe en la bandeja o por WhatsApp.
export const MODO = (process.env.CHATBOT_MODO || 'automatico').toLowerCase();
const HUELLA = crypto.createHash('sha256').update(INSTRUCCIONES).digest('hex').slice(0, 16);
const MAX_VUELTAS = 6;

const SISTEMA = [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }];

export const ACCIONES_AUTOMATICAS = ['cambiar_predecesor', 'configurar_decimal'];

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
        rmd: { type: 'string', description: 'Código del RMD (10 dígitos) si se conoce.' },
        producto: { type: 'string' },
        etapa: { type: 'string' },
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

// ---------- validación de cambios: decide si el ejecutor puede aplicarlos solo ----------
export function cambioCompleto(c) {
  if (!c || !ACCIONES_AUTOMATICAS.includes(c.accion) || !c.lista || !c.paso) return false;
  if (c.accion === 'cambiar_predecesor') return Boolean(c.sin_predecesor) !== Boolean(c.predecesor);
  if (c.accion === 'configurar_decimal') return Number.isInteger(c.decimal) && c.decimal >= 0 && c.decimal <= 6;
  return false;
}

function limpiarCambios(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map((c) => {
    const x = { accion: c.accion, lista: String(c.lista || '').trim(), paso: String(c.paso || '').trim() };
    if (Number.isInteger(c.orden_paso)) x.orden_paso = c.orden_paso;
    if (c.accion === 'cambiar_predecesor') {
      if (c.sin_predecesor) x.sin_predecesor = true;
      else if (c.predecesor) x.predecesor = String(c.predecesor).trim();
      if (Number.isInteger(c.predecesor_orden)) x.predecesor_orden = c.predecesor_orden;
    }
    if (c.accion === 'configurar_decimal' && c.decimal !== undefined) x.decimal = Number(c.decimal);
    return x;
  });
}

// ---------- herramientas ----------
async function registrarSolicitud(input, quien, mensajes) {
  const cambios = limpiarCambios(input.cambios);
  const rmdOk = /^\d{10}$/.test(String(input.rmd || '').trim());
  const automatica = input.tipo === 'cambio' && rmdOk && cambios.length > 0 && cambios.every(cambioCompleto);
  const estado = automatica && MODO === 'automatico' ? 'lista' : 'nueva';
  const fila = {
    canal: quien.canal,
    contacto: quien.contacto,
    nombre: quien.nombre || null,
    area: quien.area || null,
    tipo: input.tipo,
    prioridad: input.prioridad || 'normal',
    resumen: String(input.resumen || '').slice(0, 300),
    rmd: rmdOk ? String(input.rmd).trim() : null,
    producto: input.producto || null,
    etapa: input.etapa || null,
    planta: input.planta || null,
    op_lote: input.op_lote || null,
    detalle: String(input.detalle || ''),
    cambios,
    automatica,
    estado,
    conversacion: textoDeConversacion(mensajes).slice(-6000),
  };
  const [creada] = await sb('chatbot_solicitudes', { method: 'POST', body: fila, prefer: 'return=representation' });
  await alRegistrar(creada).catch((e) => console.error('avisos', e.message));
  let siguiente;
  if (estado === 'lista') {
    siguiente =
      'Se aplicará automáticamente en SAP con la cuenta del analista en unos minutos (Guardar y Actualizar RMD en Línea). ' +
      'El analista recibe el detalle. Avisa a la persona que le confirmaremos el resultado.';
  } else if (automatica) {
    siguiente = 'Quedó para que el analista lo apruebe; al aprobarlo se aplica solo en SAP.';
  } else {
    siguiente = 'El analista de Documentación Técnica lo revisará y responderá por este mismo chat.';
  }
  return { solicitud: creada, texto: JSON.stringify({ numero: creada.id, estado, que_sigue: siguiente }) };
}

async function verMisSolicitudes(quien) {
  const filas = await sb(
    `chatbot_solicitudes?contacto=eq.${enc(quien.contacto)}&select=id,creado,resumen,estado,resultado,respuesta_analista&order=id.desc&limit=5`
  );
  return JSON.stringify(filas.length ? filas : 'No tiene solicitudes registradas.');
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
    respuesta = await claude().beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      tools: HERRAMIENTAS,
      thinking: { type: 'adaptive' },
      output_config: { effort: ESFUERZO },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: mensajes,
    });
    mensajes.push({ role: 'assistant', content: respuesta.content });
    if (respuesta.stop_reason !== 'tool_use') break;

    const resultados = [];
    for (const b of respuesta.content) {
      if (b.type !== 'tool_use') continue;
      try {
        if (b.name === 'registrar_solicitud') {
          const r = await registrarSolicitud(b.input || {}, quien, mensajes);
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
