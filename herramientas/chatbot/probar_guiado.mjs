// Prueba del bot guiado (sin IA, opciones cerradas), sin internet.
//   node herramientas/chatbot/probar_guiado.mjs
import assert from 'node:assert/strict';
import { instalar, tablas, enviados } from './simulado.mjs';

delete process.env.CHATBOT_MOTOR; // por defecto: guiado
process.env.CHATBOT_CLAVE = 'clave-web'; // solo el chat web con clave aplica solo
process.env.CHATBOT_WHATSAPP_ANALISTA = '51999000111';
process.env.WHATSAPP_TOKEN = 'tok'; process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
process.env.GITHUB_DISPATCH_TOKEN = 'gh';
instalar();
const { default: chatbot } = await import('../../api/chatbot.js');

function llamar(body) {
  return new Promise((ok) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { ok({ status: this.statusCode, body: d }); return this; } };
    chatbot({ method: 'POST', body, headers: { 'x-clave': 'clave-web' } }, res);
  });
}
const contacto = 'web:guiado-0001';
const decir = async (texto) => (await llamar({ accion: 'mensaje', contacto, nombre: 'Ana', area: 'Produccion', texto })).body;

assert.equal((await llamar({ accion: 'estado' })).body.motor, 'guiado');
let r = await decir('hola');
assert.match(r.texto, /1\. Habilitar un paso/);
r = await decir('1'); assert.match(r.texto, /codigo del material/);
r = await decir('ab'); assert.match(r.texto, /No entendi/);
r = await decir('3000123'); assert.match(r.texto, /etapa/);
r = await decir('1'); assert.match(r.texto, /lote en proceso/);   // FABRICACION
r = await decir('1'); assert.match(r.texto, /numero de lote/);
r = await decir('l2611a'); assert.match(r.texto, /En que lista/);
r = await decir('6'); assert.match(r.texto, /orden del paso/);     // PROCEDIMIENTO>FABRICACION
r = await decir('12'); assert.match(r.texto, /Desde que paso/);
r = await decir('2'); assert.match(r.texto, /En que lista esta ese paso/);
r = await decir('3'); assert.match(r.texto, /orden del paso desde/); // DOCUMENTACION
r = await decir('4'); assert.match(r.texto, /Resumen: Material 3000123 \(FABRICACION\), lote L2611A/);
r = await decir('1');
assert.match(r.texto, /registre tu solicitud #1/);
const s = tablas.chatbot_solicitudes[0];
assert.equal(s.estado, 'lista'); assert.equal(s.automatica, true); assert.equal(s.prioridad, 'alta');
assert.equal(s.rmd, null); assert.equal(s.material, '3000123'); assert.equal(s.etapa, 'FABRICACION'); assert.equal(s.op_lote, 'L2611A');
assert.deepEqual(s.cambios[0], { accion: 'cambiar_predecesor', lista: 'PROCEDIMIENTO>FABRICACION', paso: '', orden_paso: 12,
  predecesor_orden: 4, predecesor_lista: 'PROCEDIMIENTO>DOCUMENTACION' });
assert.ok(enviados.some((e) => e.a === 'github'), 'despierta al ejecutor');
assert.ok(enviados.some((e) => e.a === 'whatsapp' && /Material 3000123 · FABRICACION/.test(e.cuerpo.text.body) && /Lote: L2611A/.test(e.cuerpo.text.body)));

// Decimales sin lote: misma lista de opciones cerradas
await decir('0'); await decir('2'); await decir('3000123'); await decir('2'); // ENVASE
r = await decir('2'); assert.match(r.texto, /En que lista/);
r = await decir('10'); r = await decir('3'); assert.match(r.texto, /Cuantos decimales/); // RENDIMIENTO, orden 3
r = await decir('3'); assert.match(r.texto, /2 decimales/);
await decir('1');
const s2 = tablas.chatbot_solicitudes[1];
assert.equal(s2.estado, 'lista'); assert.equal(s2.op_lote, null);
assert.deepEqual(s2.cambios[0], { accion: 'configurar_decimal', lista: 'PROCEDIMIENTO>RENDIMIENTO', paso: '', orden_paso: 3, decimal: 2 });

// Consulta para el analista: material opcional
await decir('0'); r = await decir('3'); assert.match(r.texto, /tipo de consulta/);
r = await decir('4'); assert.match(r.texto, /material o NO/);
r = await decir('no'); assert.match(r.texto, /lote en proceso/);
r = await decir('2'); assert.match(r.texto, /Describe/);
await decir('el boton de guardar no responde en la etiqueta envase');
const s3 = tablas.chatbot_solicitudes[2];
assert.equal(s3.estado, 'nueva'); assert.equal(s3.tipo, 'consulta'); assert.equal(s3.automatica, false);

r = await decir('4'); assert.match(r.texto, /#3/);

// Sin clave del chat web, nada se aplica solo (queda para el analista)
delete process.env.CHATBOT_CLAVE;
for (const t of ['0', '2', '3000123', '2', '2', '10', '3', '3', '1']) await decir(t);
assert.equal(tablas.chatbot_solicitudes[3].estado, 'nueva'); assert.equal(tablas.chatbot_solicitudes[3].automatica, false);  // desde el menú: ver mis solicitudes
console.log('OK: bot guiado (material + etapa + lote, habilitar paso en otra lista, decimales, consulta, mis solicitudes).');
