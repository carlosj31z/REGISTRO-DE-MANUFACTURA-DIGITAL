// Registro de solicitudes, común al bot guiado (sin IA) y al motor con Claude.
import { sb, enc } from './supabase.js';
import { alRegistrar } from './avisos.js';

// automatico: los cambios completos (habilitar paso / decimales) pasan directo al ejecutor.
// aprobacion: todo espera a que el analista lo apruebe en la bandeja o por WhatsApp.
export const MODO = (process.env.CHATBOT_MODO || 'automatico').toLowerCase();
export const ACCIONES_AUTOMATICAS = ['cambiar_predecesor', 'configurar_decimal'];
// Pedidos de solo lectura que el ejecutor atiende en SAP (no escriben nada): estado del RMD, plantilla y PDF del master.
export const ACCIONES_LECTURA = { estado_rmd: 'estado', plantilla: 'documento', pdf_master: 'documento' };

// ---------- validación de cambios: decide si el ejecutor puede aplicarlos solo ----------
export function cambioCompleto(c) {
  if (c && ACCIONES_LECTURA[c.accion]) return true;
  // El paso se identifica por su texto o por su orden; el predecesor, por texto u orden (bot guiado: solo números).
  if (!c || !ACCIONES_AUTOMATICAS.includes(c.accion) || !c.lista || !(c.paso || Number.isInteger(c.orden_paso))) return false;
  if (c.accion === 'cambiar_predecesor') return Boolean(c.sin_predecesor) !== Boolean(c.predecesor || Number.isInteger(c.predecesor_orden));
  if (c.accion === 'configurar_decimal') return Number.isInteger(c.decimal) && c.decimal >= 0 && c.decimal <= 6;
  return false;
}

export function limpiarCambios(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map((c) => {
    const x = { accion: c.accion, lista: String(c.lista || '').trim(), paso: String(c.paso || '').trim() };
    if (Number.isInteger(c.orden_paso)) x.orden_paso = c.orden_paso;
    if (c.accion === 'cambiar_predecesor') {
      if (c.sin_predecesor) x.sin_predecesor = true;
      else if (c.predecesor) x.predecesor = String(c.predecesor).trim();
      if (Number.isInteger(c.predecesor_orden)) x.predecesor_orden = c.predecesor_orden;
      if (c.predecesor_lista && !c.sin_predecesor) x.predecesor_lista = String(c.predecesor_lista).trim();
    }
    if (c.accion === 'configurar_decimal' && c.decimal !== undefined) x.decimal = Number(c.decimal);
    return x;
  });
}

const soloDigitos = (x) => String(x || '').replace(/\D/g, '');

// Origen identificado: el chat web abierto con la clave (enlace con la clave adentro o clave recordada en el equipo) o
// un número de WhatsApp de la lista. Sin clave el chat funciona, pero los cambios y los documentos los aprueba el analista.
export function origenConfiable(quien) {
  if (quien.canal === 'web') return quien.confiable === true;
  if (quien.canal === 'whatsapp') {
    const lista = (process.env.CHATBOT_WHATSAPP_PERMITIDOS || '').split(',').map(soloDigitos).filter(Boolean);
    return lista.includes(soloDigitos(String(quien.contacto).replace(/^wa:/, '')));
  }
  return false;
}

export async function registrarSolicitud(input, quien, conversacion = '') {
  const cambios = limpiarCambios(input.cambios);
  const rmdOk = /^\d{10}$/.test(String(input.rmd || '').trim());
  // El RMD se identifica por su código, por el lote (el ejecutor lo busca en «Ver OP») o por material + etapa.
  const material = String(input.material || '').trim().toUpperCase();
  const ubicable = rmdOk || Boolean(material && input.etapa) || Boolean(String(input.op_lote || '').trim());
  // El ejecutor puede atenderlo solo si es un cambio completo (habilitar paso / decimales) o un pedido de lectura.
  const tipoOk = (c) => (ACCIONES_LECTURA[c.accion] ? input.tipo === ACCIONES_LECTURA[c.accion] : input.tipo === 'cambio');
  const automatica = ubicable && cambios.length > 0 && cambios.every((c) => cambioCompleto(c) && tipoOk(c));
  // Va directo al ejecutor solo si viene de un origen identificado (o es la consulta de estado, que no escribe ni
  // entrega documentos). Lo demás queda para que el analista lo apruebe. CHATBOT_MODO=aprobacion frena los cambios.
  const soloEstado = input.tipo === 'estado';
  const estado = automatica && (soloEstado || (MODO === 'automatico' && origenConfiable(quien))) ? 'lista' : 'nueva';
  const fila = {
    canal: quien.canal,
    contacto: quien.contacto,
    nombre: quien.nombre || null,
    area: quien.area || null,
    tipo: input.tipo,
    prioridad: input.prioridad || 'normal',
    resumen: String(input.resumen || '').slice(0, 300),
    rmd: rmdOk ? String(input.rmd).trim() : null,
    material: material || null,
    producto: input.producto || null,
    etapa: input.etapa || null,
    planta: input.planta || null,
    op_lote: input.op_lote || null,
    detalle: String(input.detalle || ''),
    cambios,
    automatica,
    estado,
    conversacion: String(conversacion || '').slice(-6000),
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

export async function misSolicitudes(contacto, limite = 5) {
  return sb(
    `chatbot_solicitudes?contacto=eq.${enc(contacto)}&select=id,creado,resumen,estado,resultado,respuesta_analista&order=id.desc&limit=${limite}`
  );
}

export async function verMisSolicitudes(quien) {
  const filas = await sb(
    `chatbot_solicitudes?contacto=eq.${enc(quien.contacto)}&select=id,creado,resumen,estado,resultado,respuesta_analista&order=id.desc&limit=5`
  );
  return JSON.stringify(filas.length ? filas : 'No tiene solicitudes registradas.');
}

