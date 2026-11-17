// Prueba del asistente sin internet: conversación guionada «habilitar el paso» de punta a punta.
//   node herramientas/chatbot/probar.mjs
import assert from 'node:assert/strict';
import { instalar, tablas, enviados } from './simulado.mjs';

process.env.CHATBOT_MOTOR = 'claude'; // esta prueba es la del motor opcional con Claude; la del guiado: probar_guiado.mjs
process.env.CHATBOT_CLAVE_ANALISTA = 'clave-analista';
process.env.CHATBOT_WHATSAPP_ANALISTA = '51999000111';
process.env.WHATSAPP_TOKEN = 'tok'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
process.env.GITHUB_DISPATCH_TOKEN = 'gh';
instalar();
const { default: chatbot } = await import('../../api/chatbot.js');
const { default: whatsapp } = await import('../../api/whatsapp.js');

function llamar(handler, { method = 'POST', body, headers = {}, query } = {}) {
  return new Promise((ok) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; },
      json(d) { ok({ status: this.statusCode, body: d }); return this; }, send(d) { ok({ status: this.statusCode, body: d }); return this; },
      end() { ok({ status: this.statusCode }); return this; } };
    handler({ method, body, headers, query }, res);
  });
}
const contacto = 'web:prueba-0001';
const decir = (texto) => llamar(chatbot, { body: { accion: 'mensaje', contacto, nombre: 'Ana', area: 'Producción', texto } });

let r = await decir('necesito que habiliten el paso de tamizado del RMD 2202609013, la OP 2100033070 está parada');
assert.equal(r.status, 200); assert.match(r.body.texto, /Habilitar el paso/);
r = await decir('desde el inicio de fabricacion');
assert.match(r.body.texto, /Confirmas/);
r = await decir('sí, confirmo');
assert.equal(r.body.solicitudes.length, 1);
const s = tablas.chatbot_solicitudes[0];
assert.equal(s.estado, 'lista'); assert.equal(s.automatica, true); assert.equal(s.prioridad, 'alta');
assert.deepEqual(s.cambios[0], { accion: 'cambiar_predecesor', lista: 'PROCEDIMIENTO>FABRICACION', paso: 'TAMIZAR', predecesor: 'FECHA / HORA INICIO DE LA FABRICACION' });
assert.ok(enviados.some((e) => e.a === 'github' && e.cuerpo.event_type === 'solicitud-chatbot'), 'despierta al ejecutor');
assert.ok(enviados.some((e) => e.a === 'whatsapp' && e.cuerpo.to === '51999000111' && /Solicitud #1/.test(e.cuerpo.text.body)), 'avisa al analista');
// La conversación guardada solo crece (nunca se reescribe): user, assistant, user, assistant, user, assistant(tool_use), user(tool_result), assistant
const conv = tablas.chatbot_conversaciones[0].mensajes;
assert.deepEqual(conv.map((m) => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
assert.equal(conv[5].content[0].type, 'thinking', 'los bloques del modelo se guardan tal cual');

// Sin cambios completos → para el analista
process.env.CHATBOT_MODO = 'aprobacion';

// Bandeja: sin clave no; con clave sí. El ejecutor marca ejecutada y pide avisar.
assert.equal((await llamar(chatbot, { body: { accion: 'bandeja' } })).status, 401);
r = await llamar(chatbot, { body: { accion: 'bandeja' }, headers: { 'x-clave-analista': 'clave-analista' } });
assert.equal(r.body.solicitudes.length, 1);
s.estado = 'ejecutada'; s.resultado = 'Aplicado y verificado';
s.canal = 'whatsapp'; s.contacto = 'wa:51988777666';
r = await llamar(chatbot, { body: { accion: 'notificar', id: 1 }, headers: { 'x-clave-analista': 'clave-analista' } });
assert.ok(enviados.some((e) => e.a === 'whatsapp' && e.cuerpo.to === '51988777666' && /ya se aplicó/.test(e.cuerpo.text.body)));

// WhatsApp: verificación del webhook y comando del analista
process.env.WHATSAPP_VERIFY_TOKEN = 'v';
r = await llamar(whatsapp, { method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'v', 'hub.challenge': '42' } });
assert.equal(r.body, '42');
tablas.chatbot_solicitudes.push({ id: 2, estado: 'nueva', automatica: true, canal: 'web', contacto: 'web:x', resumen: 'decimales', cambios: [] });
const n = enviados.length;
r = await llamar(whatsapp, { body: { entry: [{ changes: [{ value: { contacts: [], messages: [{ id: 'wamid.1', from: '51999000111', type: 'text', text: { body: 'aprobar 2' } }] } }] }] } });
await new Promise((ok) => setTimeout(ok, 50));
assert.equal(tablas.chatbot_solicitudes[1].estado, 'lista');
assert.ok(enviados.slice(n).some((e) => e.a === 'github'));
// mismo mensaje reenviado por Meta: se ignora
await llamar(whatsapp, { body: { entry: [{ changes: [{ value: { contacts: [], messages: [{ id: 'wamid.1', from: '51999000111', type: 'text', text: { body: 'aprobar 2' } }] } }] }] } });
await new Promise((ok) => setTimeout(ok, 50));
// mensaje de Producción por WhatsApp → respuesta del asistente
const m = enviados.length;
await llamar(whatsapp, { body: { entry: [{ changes: [{ value: { contacts: [{ wa_id: '51911222333', profile: { name: 'Luis' } }], messages: [{ id: 'wamid.2', from: '51911222333', type: 'text', text: { body: 'hola' } }] } }] }] } });
await new Promise((ok) => setTimeout(ok, 100));
assert.ok(enviados.slice(m).some((e) => e.a === 'whatsapp' && e.cuerpo.to === '51911222333'));
console.log('OK: conversación, solicitud automática, avisos, bandeja, notificación y WhatsApp simulados.');
