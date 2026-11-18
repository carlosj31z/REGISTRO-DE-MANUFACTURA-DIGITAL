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
assert.doesNotMatch(r.texto, /con el lote basta/);

// Caso real (Carlos, 2026-11-18): habilitar para Producción 4.4.11 y 4.4.11.1 del lote 2100886 (quitar la casilla Estado CC)
r = await decir('1'); assert.match(r.texto, /¿Cómo ubico el RMD\?\n1\. Con el número de lote \(o de la orden\)\n2\. Con el código del material/);
r = await decir('1'); assert.match(r.texto, /número de lote/);
r = await decir('ab'); assert.match(r.texto, /Disculpe, no le entendí/);
r = await decir('2100886'); assert.match(r.texto, /¿De qué etapa es el RMD\?\n1\. FABRICACION\n2\. ENVASE\n3\. RECUBRIMIENTO\n4\. INSPECCION\n5\. ACONDICIONADO/);
r = await decir('fab'); assert.match(r.texto, /número del paso tal como aparece en el registro/);
r = await decir('11'); assert.match(r.texto, /número completo como aparece en el registro \(por ejemplo 4\.4\.11\)/);
r = await decir('4.4.11.- EL JEFE O SUPERVISOR VERIFICA, 4.4.11.1.- FECHA / HORA DE VERIFICACION');
assert.match(r.texto, /¿Qué necesita en esos pasos \(4\.4\.11 y 4\.4\.11\.1\)\?\n1\. Que lo registre Producción/);
r = await decir('2'); assert.match(r.texto, /4\.4\.11\.1 es un proceso menor y no tiene predecesor/);
r = await decir('1'); assert.match(r.texto, /Resumen: Lote 2100886, FABRICACION: los pasos 4\.4\.11 y 4\.4\.11\.1 quedarán para que los registre Producción \(se quita la casilla Estado CC\)/);
r = await decir('1');
assert.match(r.texto, /Registré su solicitud #1/);
const s = tablas.chatbot_solicitudes[0];
assert.equal(s.estado, 'lista'); assert.equal(s.automatica, true); assert.equal(s.prioridad, 'alta');
assert.equal(s.rmd, null); assert.equal(s.op_lote, '2100886'); assert.equal(s.etapa, 'FABRICACION');
assert.equal(s.resumen, 'Habilitar para Producción 4.4.11, 4.4.11.1');
assert.deepEqual(s.cambios, [{ accion: 'quitar_cc', numero: '4.4.11' }, { accion: 'quitar_cc', numero: '4.4.11.1' }]);
assert.ok(enviados.some((e) => e.a === 'github'), 'despierta al ejecutor');
assert.ok(enviados.some((e) => e.a === 'whatsapp' && /Paso 4\.4\.11 → quitar la casilla Estado CC/.test(e.cuerpo.text.body)));

// Decimales con el material (siempre se pide la etapa)
await decir('0'); r = await decir('2'); assert.match(r.texto, /Cómo ubico el RMD/);
r = await decir('2'); assert.match(r.texto, /código del material/);
r = await decir('3000123'); assert.match(r.texto, /etapa/);
r = await decir('2'); assert.match(r.texto, /número del paso/);        // ENVASE
r = await decir('4.5.3'); assert.match(r.texto, /Cuántos decimales/);
r = await decir('3'); assert.match(r.texto, /Material 3000123, ENVASE: el paso 4\.5\.3 se configurará con 2 decimales/);
await decir('1');
const s2 = tablas.chatbot_solicitudes[1];
assert.equal(s2.estado, 'lista'); assert.equal(s2.op_lote, null); assert.equal(s2.material, '3000123'); assert.equal(s2.etapa, 'ENVASE');
assert.deepEqual(s2.cambios, [{ accion: 'configurar_decimal', numero: '4.5.3', decimal: 2 }]);

// Consulta para el analista: puede no ser de un RMD; la descripción es texto libre (no se interpreta)
await decir('0'); r = await decir('6'); assert.match(r.texto, /tipo de consulta/);
r = await decir('4'); assert.match(r.texto, /Sobre qué es la consulta/);
r = await decir('3'); assert.match(r.texto, /Cuénteme/);
await decir('el boton de guardar no responde y necesito el pdf');
const s3 = tablas.chatbot_solicitudes[2];
assert.equal(s3.estado, 'nueva'); assert.equal(s3.tipo, 'consulta'); assert.equal(s3.automatica, false);

r = await decir('7'); assert.match(r.texto, /#3/);  // desde el menú: ver mis solicitudes

// Menú 3/4/5: plantilla, PDF del master y estado (primero el material; con lote también se pide la etapa)
await decir('0'); r = await decir('3'); assert.match(r.texto, /plantilla para Producción.*\n\n¿Cómo ubico el RMD\?\n1\. Con el código del material/s);
r = await decir('2'); assert.match(r.texto, /número de lote/);
r = await decir('L2611A'); assert.match(r.texto, /etapa/);
r = await decir('1'); assert.match(r.texto, /Registré su solicitud #4.*enlace de descarga/s);
let x = tablas.chatbot_solicitudes[3];
assert.equal(x.tipo, 'documento'); assert.equal(x.estado, 'lista'); assert.deepEqual(x.cambios[0].accion, 'plantilla'); assert.equal(x.etapa, 'FABRICACION');
await decir('0'); await decir('5'); await decir('1'); await decir('3000123'); r = await decir('1');
assert.match(r.texto, /Lo consulto en SAP/);
x = tablas.chatbot_solicitudes[4];
assert.equal(x.tipo, 'estado'); assert.equal(x.material, '3000123'); assert.equal(x.etapa, 'FABRICACION'); assert.equal(x.cambios[0].accion, 'estado_rmd');

// PDF: primero material + etapa
await decir('0'); await decir('4'); r = await decir('1'); assert.match(r.texto, /código del material/);
r = await decir('3000123'); r = await decir('5'); assert.match(r.texto, /enlace de descarga/);
assert.equal(tablas.chatbot_solicitudes.at(-1).etapa, 'ACONDICIONADO'); assert.equal(tablas.chatbot_solicitudes.at(-1).cambios[0].accion, 'pdf_master');

// Texto libre con saludo: «hola, necesito el pdf master del lote …» solo pide lo que falta (la etapa)
r = await decir('Hola, buenas tardes. Necesito el PDF master del lote L2611B por favor');
assert.match(r.texto, /PDF del master.*etapa/s);
r = await decir('envase'); assert.match(r.texto, /Registré su solicitud #7/);
x = tablas.chatbot_solicitudes[6];
assert.equal(x.tipo, 'documento'); assert.equal(x.cambios[0].accion, 'pdf_master'); assert.equal(x.op_lote, 'L2611B'); assert.equal(x.etapa, 'ENVASE');
r = await decir('quisiera saber el estado del material 3000123 envase');
assert.match(r.texto, /Registré su solicitud #8/); assert.equal(tablas.chatbot_solicitudes[7].etapa, 'ENVASE');
// Pedido escrito completo, como lo dicen en planta: todo de una vez, solo confirma
r = await decir('habilitar para PRODUCCION 4.4.11.- EL JEFE O SUPERVISOR... 4.4.11.1.- FECHA / HORA DE VERIFICACION del lote 2100886 fabricacion');
assert.match(r.texto, /Resumen: Lote 2100886, FABRICACION: los pasos 4\.4\.11 y 4\.4\.11\.1 quedarán para que los registre Producción/);
await decir('1'); assert.deepEqual(tablas.chatbot_solicitudes[8].cambios.map((c) => c.accion), ['quitar_cc', 'quitar_cc']);
// Habilitar desde otro paso, con la orden en vez del lote
r = await decir('me pueden habilitar un paso'); assert.match(r.texto, /Con gusto le ayudo a habilitar el paso/);
r = await decir('orden 2100032380'); assert.match(r.texto, /etapa/);
r = await decir('1'); r = await decir('4.4.20'); r = await decir('2'); assert.match(r.texto, /desde el que debe poder registrarse/);
r = await decir('4.4.25'); assert.match(r.texto, /Debe ser un paso anterior al 4\.4\.20/);
r = await decir('4.4.15.1'); assert.match(r.texto, /proceso menor no puede ser predecesor/);
r = await decir('4.4.15'); assert.match(r.texto, /el paso 4\.4\.20 podrá registrarse desde el paso 4\.4\.15/);
await decir('1');
assert.deepEqual(tablas.chatbot_solicitudes[9].cambios, [{ accion: 'cambiar_predecesor', numero: '4.4.20', predecesor_numero: '4.4.15' }]);
assert.equal(tablas.chatbot_solicitudes[9].op_lote, '2100032380'); assert.equal(tablas.chatbot_solicitudes[9].estado, 'lista');
r = await decir('gracias'); assert.match(r.texto, /Con mucho gusto/);
r = await decir('blablabla'); assert.match(r.texto, /Disculpe, no le entendí/);

// Resultado para el chat web: aviso sin el detalle técnico
Object.assign(tablas.chatbot_solicitudes[4], { estado: 'ejecutada', resultado: 'El RMD 2202609013 está en la versión 8 (Autorizado).' });
Object.assign(tablas.chatbot_solicitudes[0], { estado: 'revisar', resultado: 'RMD 2202609407 v4 Autorizado (X), lote 2100886 confirmado en Ver OP.\nNo se pudo aplicar solo:\n ✗ 1. paso: no hay un paso 4.4.11 en este RMD [error]' });
const mis = (await llamar({ accion: 'mis_solicitudes', contacto })).body.solicitudes;
assert.match(mis.find((m) => m.id === 5).aviso, /versión 8/);
assert.doesNotMatch(JSON.stringify(mis), /confirmado en Ver OP/);
assert.match(mis.find((m) => m.id === 1).aviso, /no se pudo completar sola: no hay un paso 4\.4\.11 en este RMD\. La revisará/);

// Avance mientras se atiende: el RMD ubicado con su descripción, antes del enlace
Object.assign(tablas.chatbot_solicitudes[3], { estado: 'ejecutando', resultado: 'Ubiqué el RMD 2202609407 v4 Autorizado: GLYCOLAX. Estoy preparando la plantilla.' });
const mis2 = (await llamar({ accion: 'mis_solicitudes', contacto })).body.solicitudes;
assert.match(mis2.find((m) => m.id === 4).avance, /GLYCOLAX/); assert.equal(mis2.find((m) => m.id === 4).aviso, '');
assert.equal(mis2.find((m) => m.id === 5).avance, '');

// Sin clave del chat web: todo lo que el ejecutor sabe atender va directo (decisión de Carlos, «Todo sin supervisión»)
const sinClave = (texto) => new Promise((ok) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { ok({ status: this.statusCode, body: d }); return this; } };
  chatbot({ method: 'POST', body: { accion: 'mensaje', contacto: 'web:sinclave-0001', texto }, headers: {} }, res);
});
assert.equal((await sinClave('hola')).status, 200);
for (const t of ['1', '1', 'L2611D', '1', '4.4.12', '3', '1']) await sinClave(t);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista'); assert.equal(tablas.chatbot_solicitudes.at(-1).op_lote, 'L2611D');
assert.deepEqual(tablas.chatbot_solicitudes.at(-1).cambios, [{ accion: 'cambiar_predecesor', numero: '4.4.12', sin_predecesor: true }]);
for (const t of ['0', '2', '2', '3000123', '2', '4.9.3', '3', '1']) await sinClave(t);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista'); assert.equal(tablas.chatbot_solicitudes.at(-1).automatica, true);
r = (await sinClave('plantilla del material 3000123 envase')).body; assert.match(r.texto, /enlace de descarga/);
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'lista');
// las consultas libres siguen para el analista
await sinClave('0'); await sinClave('6'); await sinClave('4'); await sinClave('3');
await sinClave('necesito ayuda con un paso que no se ve en la tablet');
assert.equal(tablas.chatbot_solicitudes.at(-1).estado, 'nueva');
console.log('OK: bot guiado (lote u orden o material, siempre la etapa; pasos por su número 4.4.11 / 4.4.11.1; habilitar para Producción = quitar Estado CC; predecesor y decimales; lecturas; consultas al analista).');
