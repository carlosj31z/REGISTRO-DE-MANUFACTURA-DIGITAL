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
assert.match(r.texto, /Buen(os|as) .*Ana\. Le saluda el asistente/);
assert.match(r.texto, /1\. Habilitar un paso/); assert.match(r.texto, /3\. Pedir la plantilla para Producción/);
assert.doesNotMatch(r.texto, /\p{Extended_Pictographic}/u, 'sin emojis');
r = await decir('1'); assert.match(r.texto, /Tiene el número de lote/);
r = await decir('1'); assert.match(r.texto, /número de lote/);
r = await decir('ab'); assert.match(r.texto, /Disculpe, no le entendí/);
r = await decir('l2611a'); assert.match(r.texto, /En qué lista/);   // con el lote basta
r = await decir('6'); assert.match(r.texto, /orden del paso/);     // PROCEDIMIENTO>FABRICACION
r = await decir('12'); assert.match(r.texto, /Desde qué paso/);
r = await decir('2'); assert.match(r.texto, /En qué lista está ese paso/);
r = await decir('3'); assert.match(r.texto, /orden del paso desde/); // DOCUMENTACION
r = await decir('4'); assert.match(r.texto, /Resumen: Lote L2611A, lista FABRICACION/);
r = await decir('1');
assert.match(r.texto, /Registré su solicitud #1/);
const s = tablas.chatbot_solicitudes[0];
assert.equal(s.estado, 'lista'); assert.equal(s.automatica, true); assert.equal(s.prioridad, 'alta');
assert.equal(s.rmd, null); assert.equal(s.material, null); assert.equal(s.op_lote, 'L2611A');
assert.deepEqual(s.cambios[0], { accion: 'cambiar_predecesor', lista: 'PROCEDIMIENTO>FABRICACION', paso: '', orden_paso: 12,
  predecesor_orden: 4, predecesor_lista: 'PROCEDIMIENTO>DOCUMENTACION' });
assert.ok(enviados.some((e) => e.a === 'github'), 'despierta al ejecutor');
assert.ok(enviados.some((e) => e.a === 'whatsapp' && /Lote: L2611A/.test(e.cuerpo.text.body)));

// Decimales sin lote: material + etapa (opciones cerradas)
await decir('0'); await decir('2');
r = await decir('2'); assert.match(r.texto, /código del material/);
r = await decir('3000123'); assert.match(r.texto, /etapa/);
r = await decir('2'); assert.match(r.texto, /En qué lista/);        // ENVASE
r = await decir('10'); r = await decir('3'); assert.match(r.texto, /Cuántos decimales/); // RENDIMIENTO, orden 3
r = await decir('3'); assert.match(r.texto, /Material 3000123 \(ENVASE\).*2 decimales/);
await decir('1');
const s2 = tablas.chatbot_solicitudes[1];
assert.equal(s2.estado, 'lista'); assert.equal(s2.op_lote, null); assert.equal(s2.material, '3000123'); assert.equal(s2.etapa, 'ENVASE');
assert.deepEqual(s2.cambios[0], { accion: 'configurar_decimal', lista: 'PROCEDIMIENTO>RENDIMIENTO', paso: '', orden_paso: 3, decimal: 2 });

// Consulta para el analista: material opcional; la descripción es texto libre (no se interpreta)
await decir('0'); r = await decir('6'); assert.match(r.texto, /tipo de consulta/);
r = await decir('4'); assert.match(r.texto, /Tiene el número de lote/);
r = await decir('2'); assert.match(r.texto, /material, o NO/);
r = await decir('no'); assert.match(r.texto, /Cuénteme/);
await decir('el boton de guardar no responde y necesito el pdf');
const s3 = tablas.chatbot_solicitudes[2];
assert.equal(s3.estado, 'nueva'); assert.equal(s3.tipo, 'consulta'); assert.equal(s3.automatica, false);

r = await decir('7'); assert.match(r.texto, /#3/);  // desde el menú: ver mis solicitudes

// Menú 3/4/5: plantilla, PDF del master y estado (con el lote basta; se registran sin confirmar)
await decir('0'); r = await decir('3'); assert.match(r.texto, /plantilla para Producción.*\n\n¿Cómo ubico el RMD\?\n1\. Con el código del material/s);
r = await decir('2'); assert.match(r.texto, /número de lote/);
r = await decir('L2611A'); assert.match(r.texto, /Registré su solicitud #4.*enlace de descarga/s);
let x = tablas.chatbot_solicitudes[3];
assert.equal(x.tipo, 'documento'); assert.equal(x.estado, 'lista'); assert.deepEqual(x.cambios[0].accion, 'plantilla');
await decir('0'); await decir('5'); await decir('2'); await decir('3000123'); r = await decir('1');
assert.match(r.texto, /Lo consulto en SAP/);
x = tablas.chatbot_solicitudes[4];
assert.equal(x.tipo, 'estado'); assert.equal(x.material, '3000123'); assert.equal(x.etapa, 'FABRICACION'); assert.equal(x.cambios[0].accion, 'estado_rmd');

// PDF: primero material + etapa
await decir('0'); await decir('4'); r = await decir('1'); assert.match(r.texto, /código del material/);
r = await decir('3000123'); r = await decir('3'); assert.match(r.texto, /enlace de descarga/);
assert.equal(tablas.chatbot_solicitudes.at(-1).etapa, 'ACONDICIONADO'); assert.equal(tablas.chatbot_solicitudes.at(-1).cambios[0].accion, 'pdf_master');

// Texto libre con saludo: «hola, necesito el pdf master del lote …» va directo
r = await decir('Hola, buenas tardes. Necesito el PDF master del lote L2611B por favor');
assert.match(r.texto, /Registré su solicitud #7/);
x = tablas.chatbot_solicitudes[6];
assert.equal(x.tipo, 'documento'); assert.equal(x.cambios[0].accion, 'pdf_master'); assert.equal(x.op_lote, 'L2611B');
r = await decir('quisiera saber el estado del material 3000123 envase');
assert.match(r.texto, /Registré su solicitud #8/); assert.equal(tablas.chatbot_solicitudes[7].etapa, 'ENVASE');
r = await decir('me pueden habilitar un paso'); assert.match(r.texto, /Con gusto le ayudo a habilitar un paso/);
r = await decir('gracias'); assert.match(r.texto, /Con mucho gusto/);
r = await decir('blablabla'); assert.match(r.texto, /Disculpe, no le entendí/);

// Resultado para el chat web: aviso sin el detalle técnico
Object.assign(tablas.chatbot_solicitudes[4], { estado: 'ejecutada', resultado: 'El RMD 2202609013 está en la versión 8 (Autorizado).' });
Object.assign(tablas.chatbot_solicitudes[0], { estado: 'revisar', resultado: 'detalle técnico interno' });
const mis = (await llamar({ accion: 'mis_solicitudes', contacto })).body.solicitudes;
assert.match(mis.find((m) => m.id === 5).aviso, /versión 8/);
assert.doesNotMatch(JSON.stringify(mis), /detalle técnico interno/);

// Sin clave del chat web: funciona, pero cambios y documentos esperan al analista; el estado va solo
const sinClave = (texto) => new Promise((ok) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { ok({ status: this.statusCode, body: d }); return this; } };
  chatbot({ method: 'POST', body: { accion: 'mensaje', contacto: 'web:sinclave-0001', texto }, headers: {} }, res);
});
assert.equal((await sinClave('hola')).status, 200);
// habilitar un paso con el lote: sin supervisión
for (const t of ['1', '1', 'L2611D', '6', '12', '1', '4', '1']) await sinClave(t);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista'); assert.equal(tablas.chatbot_solicitudes.at(-1).op_lote, 'L2611D');
// sin lote ni clave: también directo (decisión de Carlos, «Todo sin supervisión»)
for (const t of ['0', '2', '2', '3000123', '2', '10', '3', '3', '1']) await sinClave(t);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista'); assert.equal(tablas.chatbot_solicitudes.at(-1).automatica, true);
r = (await sinClave('plantilla del material 3000123 envase')).body; assert.match(r.texto, /enlace de descarga/);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista');
// las consultas libres siguen para el analista
await sinClave('0'); await sinClave('6'); await sinClave('4'); await sinClave('2'); await sinClave('no');
await sinClave('necesito ayuda con un paso que no se ve en la tablet');
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'nueva');
console.log('OK: bot guiado (saludos y pedidos escritos, plantilla/PDF/estado, lote solo o material + etapa, todo directo sin clave; consultas al analista).');
