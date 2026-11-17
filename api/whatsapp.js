// Webhook de WhatsApp (API oficial de WhatsApp Business, Meta Cloud API).
// GET: verificación del webhook. POST: mensajes entrantes. Responde 200 al instante y atiende después
// (Meta reintenta si tarda). Variables de entorno: ver chatbot/LEEME.md.
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { atender, reiniciarConversacion } from './_chatbot/nucleo.js';
import { sb, enc } from './_chatbot/supabase.js';
import { despertarEjecutor, enviarWhatsApp, resumenSolicitud } from './_chatbot/avisos.js';

export const config = { maxDuration: 60, api: { bodyParser: false } };

async function cuerpoCrudo(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const trozos = [];
  for await (const t of req) trozos.push(t);
  return Buffer.concat(trozos).toString('utf8');
}

function firmaValida(req, crudo) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return true; // sin secreto configurado no se verifica (solo para pruebas)
  const firma = String(req.headers['x-hub-signature-256'] || '');
  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto).update(crudo).digest('hex');
  return firma.length === esperada.length && crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada));
}

const soloDigitos = (x) => String(x || '').replace(/\D/g, '');

function permitido(numero) {
  const lista = (process.env.CHATBOT_WHATSAPP_PERMITIDOS || '').split(',').map(soloDigitos).filter(Boolean);
  return lista.length === 0 || lista.includes(soloDigitos(numero));
}

// Mensajes del analista: «aprobar 12», «rechazar 12 motivo», «responder 12 texto», «resuelta 12», «pendientes».
async function comandoAnalista(texto) {
  const t = texto.trim();
  if (/^pendientes$/i.test(t)) {
    const filas = await sb("chatbot_solicitudes?estado=in.(nueva,revisar)&select=*&order=id.asc&limit=10");
    return filas.length ? filas.map(resumenSolicitud).join('\n\n') : 'No hay solicitudes pendientes.';
  }
  const m = t.match(/^(aprobar|rechazar|responder|resuelta)\s+#?(\d+)\s*([\s\S]*)$/i);
  if (!m) return null;
  const [, verbo, id, resto] = m;
  const [s] = await sb(`chatbot_solicitudes?id=eq.${enc(id)}&select=*`);
  if (!s) return `No existe la solicitud #${id}.`;
  const v = verbo.toLowerCase();
  const cambios = {};
  if (v === 'aprobar') {
    if (!s.automatica) return `La #${id} no tiene cambios que el sistema pueda aplicar solo. Respóndele con «responder ${id} …» o márcala «resuelta ${id}».`;
    Object.assign(cambios, { estado: 'lista', aprobado_por: 'analista (WhatsApp)', aprobado_en: new Date().toISOString() });
  } else if (v === 'rechazar') {
    Object.assign(cambios, { estado: 'rechazada', respuesta_analista: resto || 'Rechazada por Documentación Técnica.' });
  } else if (v === 'responder') {
    if (!resto) return 'Escribe el texto después del número.';
    cambios.respuesta_analista = resto;
  } else {
    cambios.estado = 'resuelta';
  }
  await sb(`chatbot_solicitudes?id=eq.${enc(id)}`, { method: 'PATCH', body: cambios });
  if (cambios.estado === 'lista') await despertarEjecutor();
  if (cambios.respuesta_analista && s.canal === 'whatsapp') {
    await enviarWhatsApp(s.contacto.replace(/^wa:/, ''), `Documentación Técnica, sobre tu solicitud #${id}: ${cambios.respuesta_analista}`);
  }
  return `Solicitud #${id}: ${cambios.estado || 'respuesta enviada'}.`;
}

async function procesar(valor) {
  const nombres = Object.fromEntries((valor.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
  for (const m of valor.messages || []) {
    const numero = m.from;
    if (m.type !== 'text') {
      await enviarWhatsApp(numero, 'Por ahora solo leo mensajes de texto. Escríbeme tu consulta, por favor.');
      continue;
    }
    // Meta puede reenviar el mismo mensaje: se ignora si ya se vio.
    try {
      await sb('chatbot_mensajes_vistos', { method: 'POST', body: { id: m.id } });
    } catch {
      continue;
    }
    const texto = m.text?.body || '';
    try {
      if (soloDigitos(numero) === soloDigitos(process.env.CHATBOT_WHATSAPP_ANALISTA)) {
        const r = await comandoAnalista(texto);
        if (r) {
          await enviarWhatsApp(numero, r);
          continue;
        }
      }
      if (!permitido(numero)) {
        await enviarWhatsApp(numero, 'Este número no está habilitado para el asistente de RMD. Pídeselo a Documentación Técnica.');
        continue;
      }
      if (/^(reiniciar|nuevo|empezar de nuevo)$/i.test(texto.trim())) {
        await reiniciarConversacion(`wa:${numero}`);
        await enviarWhatsApp(numero, 'Listo, empezamos de nuevo. ¿En qué te ayudo con la configuración de un RMD?');
        continue;
      }
      const r = await atender({ canal: 'whatsapp', contacto: `wa:${numero}`, nombre: nombres[numero] }, texto);
      await enviarWhatsApp(numero, r.texto);
    } catch (e) {
      console.error('whatsapp', e);
      await enviarWhatsApp(numero, 'Tuve un problema para responder. Intenta de nuevo en un momento; si es urgente, escribe al analista de Documentación Técnica.');
    }
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] && q['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(q['hub.challenge']);
    }
    return res.status(403).send('No autorizado');
  }
  if (req.method !== 'POST') return res.status(405).end();
  const crudo = await cuerpoCrudo(req);
  if (!firmaValida(req, crudo)) return res.status(401).end();
  let datos;
  try {
    datos = JSON.parse(crudo || '{}');
  } catch {
    return res.status(400).end();
  }
  const valores = (datos.entry || []).flatMap((e) => (e.changes || []).map((c) => c.value)).filter((v) => v?.messages);
  res.status(200).json({ ok: true });
  waitUntil(Promise.allSettled(valores.map(procesar)));
}
