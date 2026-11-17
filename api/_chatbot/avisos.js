// Avisos hacia afuera: WhatsApp (API oficial de WhatsApp Business, Meta) y el ejecutor en GitHub Actions.
// Todo es opcional: si falta la variable de entorno, el aviso simplemente no se envía.
import { sb, enc } from './supabase.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export function whatsappListo() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function enviarWhatsApp(numero, texto) {
  if (!whatsappListo() || !numero) return false;
  const partes = [];
  for (let i = 0; i < texto.length; i += 3800) partes.push(texto.slice(i, i + 3800)); // límite ~4096
  for (const body of partes) {
    const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, type: 'text', text: { body } }),
    });
    if (!r.ok) console.error('WhatsApp', r.status, (await r.text()).slice(0, 300));
  }
  return true;
}

/** Despierta al ejecutor (workflow «Atender solicitudes del chatbot» de AUTOMATIZACION-DE-RMD). */
export async function despertarEjecutor() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return false;
  const repo = process.env.GITHUB_EJECUTOR_REPO || 'carlosj31z/AUTOMATIZACION-DE-RMD';
  const r = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'solicitud-chatbot' }),
  });
  if (!r.ok) console.error('GitHub dispatch', r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

export function lineaCambio(c) {
  const paso = [c.paso && `«${c.paso}»`, c.orden_paso && `#${c.orden_paso}`].filter(Boolean).join(' ');
  if (c.accion === 'cambiar_predecesor') {
    const pred = [c.predecesor && `«${c.predecesor}»`, c.predecesor_orden && `#${c.predecesor_orden}`].filter(Boolean).join(' ');
    const destino = c.sin_predecesor ? 'sin predecesor' : `depende de ${pred}${c.predecesor_lista ? ` (${c.predecesor_lista})` : ''}`;
    return `- ${c.lista}: paso ${paso} → ${destino}`;
  }
  if (c.accion === 'configurar_decimal') return `- ${c.lista}: paso ${paso} → ${c.decimal} decimales`;
  return `- ${JSON.stringify(c)}`;
}

export function resumenSolicitud(s) {
  const quien = [s.nombre, s.area].filter(Boolean).join(', ') || s.contacto;
  const lineas = [
    `Solicitud #${s.id} (${s.tipo}${s.prioridad === 'alta' ? ', PRIORIDAD ALTA' : ''}) de ${quien}`,
    s.resumen,
    s.rmd ? `RMD ${s.rmd}` : '',
    [s.material && `Material ${s.material}`, s.producto, s.etapa, s.planta].filter(Boolean).join(' · '),
    s.op_lote ? `Lote: ${s.op_lote}` : '',
    ...(s.cambios || []).map(lineaCambio),
    s.detalle ? `Detalle: ${s.detalle}` : '',
  ];
  return lineas.filter(Boolean).join('\n');
}

/** Al registrar una solicitud: aviso al analista y, si está lista, al ejecutor. */
export async function alRegistrar(s) {
  const tareas = [];
  if (s.estado === 'lista') tareas.push(despertarEjecutor());
  const analista = process.env.CHATBOT_WHATSAPP_ANALISTA;
  if (analista) {
    const pie = s.estado === 'lista'
      ? 'Se aplicará automáticamente en SAP. Te aviso el resultado.'
      : s.automatica
        ? `Responde «aprobar ${s.id}» para que se aplique solo, o «rechazar ${s.id} motivo».`
        : `Responde «responder ${s.id} <texto>» para contestarle, o «resuelta ${s.id}».`;
    tareas.push(enviarWhatsApp(analista, `${resumenSolicitud(s)}\n\n${pie}`));
  }
  await Promise.allSettled(tareas);
}

/** Tras ejecutarse (lo llama el ejecutor): resultado a quien pidió y al analista. */
export async function notificarResultado(id) {
  const [s] = await sb(`chatbot_solicitudes?id=eq.${enc(id)}&select=*`);
  if (!s) return null;
  const ok = s.estado === 'ejecutada';
  const aPersona = ok
    ? `Listo: tu solicitud #${s.id} ya se aplicó en SAP${s.rmd ? ` (RMD ${s.rmd})` : ''} y se actualizó el RMD en línea. ${s.resumen}`
    : `Tu solicitud #${s.id} necesita que la revise el analista de Documentación Técnica; te escribirá por aquí. ${s.resumen}`;
  const tareas = [];
  if (s.canal === 'whatsapp') tareas.push(enviarWhatsApp(s.contacto.replace(/^wa:/, ''), aPersona));
  if (process.env.CHATBOT_WHATSAPP_ANALISTA) {
    tareas.push(enviarWhatsApp(process.env.CHATBOT_WHATSAPP_ANALISTA, `Solicitud #${s.id}: ${s.estado.toUpperCase()}\n${s.resultado || ''}`));
  }
  await Promise.allSettled(tareas);
  return s;
}
