// API del asistente de configuraciones para el chat web (/chatbot/) y la bandeja del analista.
// POST JSON { accion, ... }. Variables de entorno: ver chatbot/LEEME.md.
import { atender, reiniciarConversacion, motorListo, MOTOR } from './_chatbot/motor.js';
import { MODO } from './_chatbot/solicitudes.js';
import { sb, enc } from './_chatbot/supabase.js';
import { despertarEjecutor, enviarWhatsApp, notificarAvance, notificarResultado, textoParaPersona, whatsappListo } from './_chatbot/avisos.js';

export const config = { maxDuration: 60 };

const ESTADOS = ['nueva', 'lista', 'ejecutando', 'ejecutada', 'revisar', 'rechazada', 'resuelta'];

function esAnalista(req) {
  const clave = process.env.CHATBOT_CLAVE_ANALISTA;
  return Boolean(clave) && req.headers['x-clave-analista'] === clave;
}

// El chat funciona sin clave (pedido de Carlos, 2026-11-17). Con la clave (enlace que la trae, recordada en el
// equipo) el origen queda identificado y los cambios y documentos van directo al ejecutor.
function conClave(req) {
  const clave = process.env.CHATBOT_CLAVE;
  return (Boolean(clave) && req.headers['x-clave'] === clave) || esAnalista(req);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  try {
    switch (b.accion) {
      case 'estado':
        return res.json({
          modo: MODO,
          whatsapp: whatsappListo(),
          requiereClave: false,
          conClave: conClave(req),
          listo: motorListo(),
          motor: MOTOR,
        });

      case 'mensaje': {
        const texto = String(b.texto || '').trim().slice(0, 4000);
        const contacto = String(b.contacto || '').trim();
        if (!texto || !/^web:[\w-]{8,64}$/.test(contacto)) return res.status(400).json({ error: 'Falta el mensaje o el contacto.' });
        const r = await atender({ canal: 'web', contacto, nombre: b.nombre, area: b.area, confiable: conClave(req) }, texto);
        return res.json(r);
      }

      case 'reiniciar':
        await reiniciarConversacion(String(b.contacto || ''));
        return res.json({ ok: true });

      case 'mis_solicitudes': {
        // Para el chat web: al terminar, el mismo texto que recibiría por WhatsApp (sin el detalle técnico del ejecutor).
        const contacto = String(b.contacto || '');
        if (!/^web:[\w-]{8,64}$/.test(contacto)) return res.status(400).json({ error: 'Falta el contacto.' });
        const filas = await sb(
          `chatbot_solicitudes?contacto=eq.${enc(contacto)}&select=id,creado,tipo,resumen,estado,resultado,respuesta_analista&order=id.desc&limit=20`
        );
        const FINALES = ['ejecutada', 'revisar', 'rechazada', 'resuelta'];
        return res.json({
          solicitudes: filas.map((s) => ({
            id: s.id, creado: s.creado, resumen: s.resumen, estado: s.estado, respuesta_analista: s.respuesta_analista,
            aviso: FINALES.includes(s.estado) ? textoParaPersona(s) : '',
            avance: s.estado === 'ejecutando' ? s.resultado || '' : '',
          })),
        });
      }

      // ---- bandeja del analista ----
      case 'bandeja': {
        if (!esAnalista(req)) return res.status(401).json({ error: 'Clave de analista incorrecta.' });
        const filas = await sb('chatbot_solicitudes?select=*&order=id.desc&limit=200');
        return res.json({ solicitudes: filas, modo: MODO });
      }

      case 'actualizar': {
        if (!esAnalista(req)) return res.status(401).json({ error: 'Clave de analista incorrecta.' });
        const id = Number(b.id);
        const cambios = {};
        if (b.estado) {
          if (!ESTADOS.includes(b.estado)) return res.status(400).json({ error: 'Estado no válido.' });
          cambios.estado = b.estado;
        }
        if (typeof b.respuesta === 'string' && b.respuesta.trim()) cambios.respuesta_analista = b.respuesta.trim();
        if (b.estado === 'lista') {
          cambios.aprobado_por = String(b.analista || 'analista');
          cambios.aprobado_en = new Date().toISOString();
        }
        const [s] = await sb(`chatbot_solicitudes?id=eq.${id}`, { method: 'PATCH', body: cambios, prefer: 'return=representation' });
        if (!s) return res.status(404).json({ error: 'No existe la solicitud.' });
        if (b.estado === 'lista') await despertarEjecutor().catch(() => {});
        if (cambios.respuesta_analista && s.canal === 'whatsapp') {
          await enviarWhatsApp(s.contacto.replace(/^wa:/, ''), `Documentación Técnica, sobre tu solicitud #${s.id}: ${cambios.respuesta_analista}`);
        }
        return res.json({ solicitud: s });
      }

      case 'notificar': {
        if (!esAnalista(req)) return res.status(401).json({ error: 'Clave de analista incorrecta.' });
        const s = b.avance ? await notificarAvance(Number(b.id)) : await notificarResultado(Number(b.id));
        return res.json({ ok: Boolean(s) });
      }

      default:
        return res.status(400).json({ error: 'Acción desconocida.' });
    }
  } catch (e) {
    console.error('chatbot', e);
    return res.status(500).json({ error: 'No se pudo atender: ' + e.message });
  }
}
