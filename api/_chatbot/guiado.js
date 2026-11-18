// Bot guiado SIN IA (gratis): menús numerados y opciones cerradas. Pedido de Carlos (2026-11-16).
// Trata de usted, con tono cordial y sin emojis (pedido de Carlos, 2026-11-17). Entiende saludos y pedidos escritos con
// palabras comunes («PDF master del lote L2611A») por palabras clave, sin IA.
// Solo se escribe texto libre en: código del material, lote, números de orden y la descripción de una consulta.
// El RMD no se pide (Producción no lo tiene a mano): lote (u orden) o código del material, y siempre la etapa (un lote
// tiene un RMD por etapa). El paso se indica con su número del registro (4.4.11 o 4.4.11.1), como lo dice Producción.
// El estado de cada conversación se guarda en chatbot_conversaciones (columna mensajes = { paso, d }).
import { sb, enc } from './supabase.js';
import { MODO, registrarSolicitud, misSolicitudes } from './solicitudes.js';

const HUELLA = 'guiado-4';

// Etapas del RMD en el orden que usa Producción (pedido de Carlos, 2026-11-18): FAB, ENV, REC, INS, ACO.
const ETAPAS = ['FABRICACION', 'ENVASE', 'RECUBRIMIENTO', 'INSPECCION', 'ACONDICIONADO'];
const ABREV_ETAPA = { fab: 0, fabr: 0, env: 1, rec: 2, recub: 2, ins: 3, insp: 3, aco: 4, acond: 4 };
const DECIMALES = [0, 1, 2, 3, 4];

const TEMAS = [
  ['Error del portal', 'incidencia', 'normal'],
  ['OP o lote detenido', 'incidencia', 'alta'],
  ['Otro cambio en el RMD (pasos, textos, rangos, versión nueva…)', 'cambio', 'normal'],
  ['Otra consulta', 'consulta', 'normal'],
];

// Pedidos de solo lectura que el ejecutor atiende en SAP: plantilla para Producción, PDF del master y estado del RMD.
const LECTURAS = {
  plantilla: { accion: 'plantilla', tipo: 'documento', titulo: 'Plantilla para Producción' },
  pdf: { accion: 'pdf_master', tipo: 'documento', titulo: 'PDF del master' },
  estado: { accion: 'estado_rmd', tipo: 'estado', titulo: 'Estado del RMD' },
};

// «Habilitar un paso» puede ser tres cosas distintas (pedido de Carlos, 2026-11-18).
const QUE = [
  ['cc', 'Que lo registre Producción (hoy le toca a Calidad en Operaciones: se quita la casilla Estado CC)'],
  ['pred', 'Que se pueda registrar antes (cambiar el paso del que depende)'],
  ['sin', 'Que no dependa de ningún paso (quitar el predecesor)'],
];

const FAQ = [
  ['¿Qué es «habilitar un paso»?',
    'Puede ser: (1) que lo registre Producción en vez de Calidad en Operaciones, quitando la casilla Estado CC del paso; (2) que se pueda registrar antes, cambiando su predecesor (Depende) por un paso anterior; o (3), en casos extremos, dejarlo sin predecesor. Pídalo con la opción 1 del menú y el número del paso tal como aparece en el registro (por ejemplo 4.4.11).'],
  ['¿Por qué no se cambia el texto de un RMD Autorizado?',
    'En un RMD Autorizado no se edita ninguna palabra de sus pasos. Un cambio de texto o de pasos va en una versión nueva, que luego se vuelve a autorizar. La casilla Estado CC, el predecesor y los decimales sí se ajustan en el mismo RMD.'],
  ['¿Cuántos decimales se usan?',
    'Lo habitual es 3 en cantidades (números, fórmula, entrega, muestra), 0 en unidades enteras (cajas, folios) y 1 en velocidad o temperatura de proceso. Se cambia en el RMD, no en el paso maestro.'],
  ['¿Cuándo llega un cambio a la OP en proceso?',
    'Después de guardar se pulsa «Actualizar RMD en Línea», y así el cambio llega a la OP que está en proceso. El sistema lo hace solo al aplicar su solicitud.'],
  ['¿Qué reglas siguen los textos de los pasos?',
    'Van en mayúsculas y sin tildes. Se dice CALIDAD EN OPERACIONES (no Control de Calidad), salvo biocarga, la nota del granel y el cierre de Acondicionado con FPRO-250. La casilla PM OP no se marca.'],
  ['¿Qué pasos no llevan predecesor?',
    'Rendimiento, Condiciones ambientales, los pasos «Sin tipo de dato» y los procesos menores (como 4.4.11.1). Solo se admite un predecesor por paso.'],
  ['¿Cómo recibo la plantilla o el PDF del master?',
    'Elija la opción 3 o 4 del menú e indique el código del material y la etapa (o el lote). Le confirmo cuál es el RMD y en unos minutos le envío por aquí un enlace para descargarlo, válido por 7 días.'],
];

const OPCIONES_MENU = [
  'Habilitar un paso (que lo registre Producción o que se registre antes)',
  'Cambiar los decimales de un dato',
  'Pedir la plantilla para Producción',
  'Pedir el PDF del master',
  'Consultar el estado de un RMD (última versión)',
  'Consulta o problema para el analista',
  'Ver mis solicitudes',
  'Preguntas frecuentes',
];
const N_MENU = OPCIONES_MENU.length;

function saludoHora() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false })) % 24;
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function menu(quien, entrada = 'saludo') {
  const nombre = quien && quien.nombre ? `, ${String(quien.nombre).split(/\s+/)[0]}` : '';
  const inicio = entrada === 'saludo'
    ? `${saludoHora()}${nombre}. Le saluda el asistente de Documentación Técnica para los RMD. ¿En qué le puedo ayudar?`
    : entrada === 'otra' ? '¿Le puedo ayudar en algo más?' : '¿En qué le puedo ayudar?';
  return [inicio, ...OPCIONES_MENU.map((o, i) => `${i + 1}. ${o}`), '',
    'También puede escribirme lo que necesita, por ejemplo: «habilitar para Producción el 4.4.11 del lote 2100886, fabricación».'].join('\n');
}

const lista = (titulo, opciones) => [titulo, ...opciones.map((o, i) => `${i + 1}. ${o}`), '0. Volver al menú'].join('\n');
const elegir = (texto, n) => { const k = Number(String(texto).trim()); return Number.isInteger(k) && k >= 1 && k <= n ? k : null; };
const MATERIAL = /^[A-Za-z0-9-]{4,18}$/;
const LOTE = /^[A-Za-z0-9-]{3,15}$/;
const CONFIRMAR = '1. Confirmar\n2. Corregir (empezar de nuevo)\n0. Cancelar';

// Números de paso como los ve Producción en el registro: 4.4.11 (paso) o 4.4.11.1 (proceso menor).
const RE_NUM_PASO = /(?<![\d.])(\d{1,2}(?:\.\d{1,3}){2,3})(?![\d])/g;
const numerosDe = (texto) => [...new Set([...String(texto || '').matchAll(RE_NUM_PASO)]
  .map((m) => m[1].split('.').map((x) => String(Number(x))).join('.')))];
const esProcesoMenor = (n) => n.split('.').length === 4;
const partes = (n) => n.split('.').map(Number);
// a < b en el orden del registro (solo se comparan pasos de la misma lista: mismos dos primeros números)
const anterior = (a, b) => { const x = partes(a), y = partes(b); return x[0] === y[0] && x[1] === y[1] ? x[2] < y[2] : true; };
const unir = (ns) => (ns.length <= 1 ? ns.join('') : `${ns.slice(0, -1).join(', ')} y ${ns.at(-1)}`);

const PREGUNTA = {
  material: 'Por favor, escriba el código del material (el de la OP o del producto).',
  etapa: lista('¿De qué etapa es el RMD?', ETAPAS),
  // Cambios: primero el lote (identifica la OP en proceso); plantilla, PDF y estado: primero el material (pedido de Carlos).
  ubicarCambio: '¿Cómo ubico el RMD?\n1. Con el número de lote (o de la orden)\n2. Con el código del material\n0. Volver al menú',
  ubicar: '¿Cómo ubico el RMD?\n1. Con el código del material\n2. Con el número de lote (o de la orden)\n0. Volver al menú',
  opNumero: 'Por favor, escriba el número de lote (o el número de la orden).',
  numeros: 'Escriba el número del paso tal como aparece en el registro, por ejemplo 4.4.11. Si son varios, sepárelos con comas: 4.4.11, 4.4.11.1',
  que: (ns) => lista(`¿Qué necesita en ${ns.length > 1 ? 'esos pasos' : 'ese paso'} (${unir(ns)})?`, QUE.map((q) => q[1])),
  predNum: 'Escriba el número del paso desde el que debe poder registrarse, por ejemplo 4.4.5.',
  decimales: lista('¿Cuántos decimales necesita?', DECIMALES.map(String)),
  tema: lista('¿Qué tipo de consulta es?', TEMAS.map((t) => t[0])),
  opConsulta: '¿Sobre qué es la consulta?\n1. Un lote u orden en proceso\n2. Un producto (le doy el código del material)\n3. No es sobre un RMD en particular\n0. Volver al menú',
  descripcion: 'Cuénteme en un solo mensaje lo que necesita (qué paso, qué ocurre y qué espera).',
};

// ---------- texto libre: saludos y pedidos con palabras comunes (sin IA) ----------
const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SALUDO = /^(hola|buen[oa]s?( dias| tardes| noches)?|saludos|que tal|buen dia|alo|hey|ola)\b/;
const GRACIAS = /^(muchas )?gracias\b|^ok,? gracias|^listo,? gracias|^perfecto,? gracias|^mil gracias/;
const DESPEDIDA = /^(chau|adios|hasta luego|nos vemos|bye)\b/;

// «Habilitar para Producción» = quitar la casilla Estado CC (lo registra Producción y no Calidad en Operaciones).
const RE_CC = /habilit\w* (el paso |los pasos )?para produccion|para que (lo )?(registre|llene|firme|anote) produccion|(casilla|check|estado) (de )?cc\b|quitar (el |la )?(check|casilla)|lo (registra|llena) calidad|le toca a calidad|solo (deja|puede) calidad/;
const RE_SIN_PRED = /sin predecesor|quitar (el )?predecesor|que no dependa/;
const INTENCIONES = [
  ['pdf', /\bpdf\b|\bmaster\b|\bmaestro\b/],
  ['plantilla', /plantilla|borrador/],
  ['estado', /\bestado (del?|de un|de la|de mi) (rmd|registro|version|master|material|producto|lote)\b|que estado|\bstatus\b|\bestatus\b|ultima version|version vigente|\bvigente\b|en que version|esta autorizad/],
  ['habilitar', /habilit|predecesor|\bdepende\b|no (me )?deja (registrar|anotar|llenar|firmar)|paso bloquead|desbloque|casilla (de )?cc|estado cc|para produccion/],
  ['decimales', /decimal/],
  ['mis', /mis solicitudes|mi solicitud|como va (mi|el) (pedido|solicitud)|seguimiento/],
  ['consulta', /\berror\b|problema|\bfalla|no carga|detenid|no funciona|no responde|consulta|ayuda con/],
  ['faq', /pregunta(s)? frecuente/],
];

function etapaDe(t) {
  const p = plano(t);
  const exacta = ETAPAS.findIndex((e) => new RegExp(`\\b${e.toLowerCase()}\\b`).test(p));
  if (exacta >= 0) return ETAPAS[exacta];
  const ab = (p.match(/\b(fab|fabr|env|rec|recub|ins|insp|aco|acond)\b\.?/) || [])[1];
  return ab ? ETAPAS[ABREV_ETAPA[ab]] : '';
}

function entender(texto) {
  const t = plano(texto);
  const intencion = (INTENCIONES.find(([, re]) => re.test(t)) || [null])[0];
  const lote = (String(texto).match(/\b(?:lote|orden|op)\s*(?:n(?:ro|°|º)?\.?\s*)?[:#]?\s*([A-Za-z0-9-]{3,15})\b/i) || [])[1];
  const material = (String(texto).match(/\bmaterial\s*[:#]?\s*([A-Za-z0-9-]{4,18})\b/i) || [])[1];
  return {
    intencion, lote: lote && /\d/.test(lote) ? lote.toUpperCase() : '', material: material && /\d/.test(material) ? material.toUpperCase() : '',
    etapa: etapaDe(texto), numeros: numerosDe(texto),
    que: RE_CC.test(t) ? 'cc' : RE_SIN_PRED.test(t) ? 'sin' : '',
    saludo: SALUDO.test(t), gracias: GRACIAS.test(t), despedida: DESPEDIDA.test(t),
  };
}

function donde(d) {
  const etapa = d.etapa ? `, ${d.etapa}` : '';
  return d.op ? `lote ${d.op}${etapa}` : d.material ? `material ${d.material}${etapa}` : 'sin RMD indicado';
}

function resumen(d) {
  const base = donde(d).replace(/^./, (c) => c.toUpperCase());
  const ns = unir(d.nums || []), pl = (d.nums || []).length > 1;
  if (d.accion === 'configurar_decimal') return `${base}: ${pl ? 'los pasos' : 'el paso'} ${ns} se ${pl ? 'configurarán' : 'configurará'} con ${d.decimal} decimales.`;
  if (d.que === 'cc') return `${base}: ${pl ? 'los pasos' : 'el paso'} ${ns} ${pl ? 'quedarán' : 'quedará'} para que ${pl ? 'los' : 'lo'} registre Producción (se quita la casilla Estado CC).`;
  if (d.que === 'sin') return `${base}: ${pl ? 'los pasos' : 'el paso'} ${ns} ${pl ? 'quedarán' : 'quedará'} sin predecesor.`;
  return `${base}: ${pl ? 'los pasos' : 'el paso'} ${ns} ${pl ? 'podrán' : 'podrá'} registrarse desde el paso ${d.predNum}.`;
}

function tituloCambio(d) {
  const ns = (d.nums || []).join(', ');
  if (d.accion === 'configurar_decimal') return `Decimales ${ns}: ${d.decimal}`;
  if (d.que === 'cc') return `Habilitar para Producción ${ns}`;
  if (d.que === 'sin') return `Quitar predecesor ${ns}`;
  return `Habilitar ${ns} desde ${d.predNum}`;
}

async function cargar(contacto) {
  const [c] = await sb(`chatbot_conversaciones?contacto=eq.${enc(contacto)}&select=*`);
  if (!c || c.huella !== HUELLA || Date.now() - new Date(c.actualizado).getTime() > 2 * 3600 * 1000) return { paso: 'menu', d: {} };
  return c.mensajes && c.mensajes.paso ? c.mensajes : { paso: 'menu', d: {} };
}

async function guardar(contacto, estado) {
  await sb('chatbot_conversaciones', {
    method: 'POST',
    body: { contacto, huella: HUELLA, mensajes: estado, actualizado: new Date().toISOString() },
    prefer: 'resolution=merge-duplicates',
  });
}

export async function reiniciarConversacion(contacto) {
  await sb(`chatbot_conversaciones?contacto=eq.${enc(contacto)}`, { method: 'DELETE' });
}

const ETIQUETA_ESTADO = {
  nueva: 'la revisa el analista', lista: 'en cola para SAP', ejecutando: 'atendiéndose en SAP', ejecutada: 'atendida',
  revisar: 'la revisa el analista', rechazada: 'rechazada', resuelta: 'resuelta',
};

async function textoMisSolicitudes(contacto) {
  const filas = await misSolicitudes(contacto, 5);
  if (!filas.length) return 'Por ahora no tiene solicitudes registradas.';
  return 'Sus últimas solicitudes:\n' + filas.map((s) => `#${s.id} - ${ETIQUETA_ESTADO[s.estado] || s.estado} - ${s.resumen}` +
    (s.respuesta_analista ? `\n   Analista: ${s.respuesta_analista}` : '')).join('\n');
}

async function registrar(quien, d) {
  let input;
  if (d.flujo === 'lectura') {
    const L = LECTURAS[d.lectura];
    input = {
      tipo: L.tipo, prioridad: 'normal', resumen: `${L.titulo} - ${donde(d)}`,
      material: d.material || undefined, etapa: d.etapa || undefined, op_lote: d.op || undefined,
      detalle: `${L.titulo} del RMD del ${donde(d)}.`, cambios: [{ accion: L.accion }],
    };
  } else if (d.flujo === 'consulta') {
    const [titulo, tipo, prioridad] = TEMAS[d.tema - 1];
    input = {
      tipo, prioridad: d.op ? 'alta' : prioridad, resumen: `${titulo}${d.op || d.material ? ` - ${donde(d)}` : ''}`,
      material: d.material || undefined, etapa: d.etapa || undefined, op_lote: d.op || undefined, detalle: d.descripcion, cambios: [],
    };
  } else {
    // Un cambio por paso, identificado por su número del registro (el ejecutor lo ubica en el RMD).
    const cambios = d.nums.map((numero) => {
      if (d.accion === 'configurar_decimal') return { accion: 'configurar_decimal', numero, decimal: d.decimal };
      if (d.que === 'cc') return { accion: 'quitar_cc', numero };
      if (d.que === 'sin') return { accion: 'cambiar_predecesor', numero, sin_predecesor: true };
      return { accion: 'cambiar_predecesor', numero, predecesor_numero: d.predNum };
    });
    input = {
      tipo: 'cambio', prioridad: d.op ? 'alta' : 'normal', resumen: tituloCambio(d),
      material: d.material || undefined, etapa: d.etapa, op_lote: d.op || undefined, detalle: resumen(d), cambios,
    };
  }
  const { solicitud } = await registrarSolicitud(input, quien, `Bot guiado: ${JSON.stringify(d)}`);
  let sigue;
  if (d.flujo === 'lectura' && solicitud.estado === 'lista') {
    sigue = d.lectura === 'estado'
      ? 'Lo consulto en SAP y le respondo por aquí; suele tomar entre 2 y 3 minutos.'
      : 'Lo preparo desde SAP. Primero ubico el RMD y le confirmo por aquí cuál es (descripción y versión); luego le envío el enlace de descarga. En total suele tomar entre 2 y 4 minutos.';
  } else if (d.flujo === 'lectura') {
    sigue = 'Documentación Técnica lo revisará y se lo enviará por aquí.';
  }
  else if (solicitud.estado === 'lista') sigue = 'Se aplicará en SAP (guardar y «Actualizar RMD en Línea»). Primero ubico el RMD y le confirmo por aquí cuál es; luego le aviso el resultado. En total suele tomar entre 3 y 5 minutos.';
  else if (solicitud.automatica) sigue = 'El analista la aprobará y se aplicará sola en SAP. Le aviso por aquí.';
  else sigue = 'El analista de Documentación Técnica la revisará y le responderá por aquí.';
  return { solicitud, texto: `Gracias. Registré su solicitud #${solicitud.id}. ${sigue}\n\n0. Volver al menú` };
}

const FLUJOS = {
  habilitar: [{ flujo: 'cambio', accion: 'habilitar' }, 'Con gusto le ayudo a habilitar el paso.'],
  decimales: [{ flujo: 'cambio', accion: 'configurar_decimal' }, 'Con gusto le ayudo a cambiar los decimales.'],
  plantilla: [{ flujo: 'lectura', lectura: 'plantilla' }, 'Con gusto le preparo la plantilla para Producción.'],
  pdf: [{ flujo: 'lectura', lectura: 'pdf' }, 'Con gusto le preparo el PDF del master.'],
  estado: [{ flujo: 'lectura', lectura: 'estado' }, 'Con gusto le consulto el estado del RMD.'],
};

// Lo que se entendió de un texto libre se aprovecha: solo se pregunta lo que falta.
function conLoEntendido(d, x) {
  const o = { ...d };
  if (x.lote) { o.op = x.lote; delete o.material; }
  else if (x.material) { o.material = x.material; o.op = ''; }
  if (x.etapa && (o.op || o.material)) o.etapa = x.etapa;
  if (o.flujo === 'cambio' && x.numeros && x.numeros.length) o.nums = x.numeros;
  if (o.accion === 'habilitar' && x.que) o.que = x.que;
  return o;
}

// Siguiente pregunta según lo que falta (o el registro, si ya está todo).
function siguientePaso(d) {
  if (d.flujo === 'consulta') {
    if (d.tema == null) return ['tema', PREGUNTA.tema];
    if (d.op === undefined && d.material === undefined) return ['opConsulta', PREGUNTA.opConsulta];
    if ((d.op || d.material) && !d.etapa) return ['etapa', PREGUNTA.etapa];
    return ['descripcion', PREGUNTA.descripcion];
  }
  if (!d.op && !d.material) return d.flujo === 'cambio' ? ['ubicarCambio', PREGUNTA.ubicarCambio] : ['ubicar', PREGUNTA.ubicar];
  if (!d.etapa) return ['etapa', PREGUNTA.etapa];
  if (d.flujo === 'lectura') return ['registrar', ''];
  if (!d.nums || !d.nums.length) return ['numeros', PREGUNTA.numeros];
  if (d.accion === 'configurar_decimal') return d.decimal == null ? ['decimales', PREGUNTA.decimales] : ['confirmar', ''];
  if (!d.que) return ['que', PREGUNTA.que(d.nums)];
  if (d.que === 'pred' && !d.predNum) return ['predNum', PREGUNTA.predNum];
  return ['confirmar', ''];
}

/**
 * Atiende un mensaje con el bot guiado.
 * @returns {Promise<{texto:string, solicitudes:object[]}>}
 */
export async function atender(quien, texto) {
  const t = String(texto || '').trim();
  let { paso, d } = await cargar(quien.contacto);
  const responder = async (nuevoPaso, salida, datos = d, solicitudes = []) => {
    await guardar(quien.contacto, { paso: nuevoPaso, d: datos });
    return { texto: salida, solicitudes };
  };
  // Avanza a la siguiente pregunta que falte; con todo, confirma (cambios) o registra (lecturas).
  const avanzar = async (datos, intro = '') => {
    const [p, pregunta] = siguientePaso(datos);
    const pre = intro ? `${intro}\n\n` : '';
    if (p === 'registrar') {
      const r = await registrar(quien, datos);
      return responder('menu', pre + r.texto, {}, [r.solicitud]);
    }
    if (p === 'confirmar') {
      const aviso = datos.que === 'sin'
        ? 'Quitar el predecesor es la excepción: Documentación Técnica lo revisará si el paso no es condicional o en paralelo.\n\n' : '';
      return responder('confirmar', `${pre}${aviso}Resumen: ${resumen(datos)}\n\n${CONFIRMAR}`, datos);
    }
    return responder(p, pre + pregunta, datos);
  };
  const arrancar = async (intencion, x = {}) => {
    if (intencion === 'mis') return responder('menu', `${await textoMisSolicitudes(quien.contacto)}\n\n0. Volver al menú`, {});
    if (intencion === 'faq') return responder('faq', lista('Preguntas frecuentes:', FAQ.map((f) => f[0])), {});
    if (intencion === 'consulta') return avanzar({ flujo: 'consulta' });
    const [d0, intro] = FLUJOS[intencion];
    return avanzar(conLoEntendido(d0, x), intro);
  };
  // Respuesta que no encaja con la pregunta: si se entiende un pedido escrito, se atiende; si no, se repregunta.
  const repreguntar = (pregunta, motivo = 'Disculpe, no le entendí.') => responder(paso, `${motivo}\n\n${pregunta}`);
  const invalido = (pregunta) => {
    const x = entender(t);
    if (x.intencion && t.length > 3) return arrancar(x.intencion, x);
    return repreguntar(pregunta);
  };
  const preguntaActual = () => (siguientePaso(d)[0] === paso ? siguientePaso(d)[1] : menu(quien, 'menu'));

  if (t === '0' || /^(menu|menú|inicio|cancelar|reiniciar)$/i.test(t)) return responder('menu', menu(quien, 'menu'), {});
  // Saludos, agradecimientos y pedidos escritos (en el menú, o con saludo en medio de un flujo). La descripción
  // de una consulta es texto libre: ahí no se interpreta nada.
  if (paso !== 'descripcion' && !(paso === 'menu' && elegir(t, N_MENU))) {
    const x = entender(t);
    if (x.intencion && (paso === 'menu' || x.saludo)) return arrancar(x.intencion, x);
    if (x.gracias) return responder('menu', 'Con mucho gusto. Si necesita algo más, aquí estoy.\n\n0. Volver al menú', {});
    if (x.despedida) return responder('menu', 'Hasta luego, que tenga un buen día.', {});
    if (x.saludo || !t) return responder('menu', menu(quien), {});
    if (paso === 'menu') return responder('menu', `Disculpe, no le entendí.\n\n${menu(quien, 'menu')}`, {});
  }

  switch (paso) {
    case 'menu': {
      const k = elegir(t, N_MENU);
      return arrancar(['habilitar', 'decimales', 'plantilla', 'pdf', 'estado', 'consulta', 'mis', 'faq'][k - 1]);
    }
    case 'faq': {
      const k = elegir(t, FAQ.length);
      if (!k) return invalido(lista('Preguntas frecuentes:', FAQ.map((f) => f[0])));
      return responder('faq', `${FAQ[k - 1][1]}\n\nSi tiene otra pregunta, escriba su número (1-${FAQ.length}).\n0. Volver al menú`);
    }
    case 'ubicarCambio':
    case 'ubicar': {
      const k = elegir(t, 2);
      const porLote = paso === 'ubicarCambio' ? k === 1 : k === 2;
      if (k && porLote) return responder('opNumero', PREGUNTA.opNumero, { ...d, material: undefined });
      if (k) return responder('material', PREGUNTA.material, { ...d, op: '' });
      // Escribió directamente el lote, el material o un pedido completo
      const x = entender(t);
      if (x.lote || x.material) return avanzar(conLoEntendido(d, x));
      if (/^\d{6,8}$/.test(t)) return avanzar({ ...d, op: t }); // un número suelto de 6 a 8 cifras: lote
      if (MATERIAL.test(t) && /\d/.test(t) && /[A-Za-z]/.test(t)) return avanzar({ ...d, op: '', material: t.toUpperCase() });
      return invalido(PREGUNTA[paso]);
    }
    case 'opNumero': {
      const x = entender(t);
      const m = x.lote || (t.match(/([A-Za-z0-9-]{3,15})\s*$/) || [])[1];
      if (!m || !LOTE.test(m) || !/\d/.test(m)) return invalido(PREGUNTA.opNumero);
      return avanzar(conLoEntendido({ ...d, op: m.toUpperCase() }, { ...x, lote: '' }));
    }
    case 'material':
      if (!MATERIAL.test(t) || !/\d/.test(t)) return invalido(PREGUNTA.material);
      return avanzar({ ...d, op: '', material: t.toUpperCase() });
    case 'etapa': {
      const k = elegir(t, ETAPAS.length);
      const e = k ? ETAPAS[k - 1] : etapaDe(t);
      if (!e) return invalido(PREGUNTA.etapa);
      return avanzar({ ...d, etapa: e });
    }
    case 'numeros': {
      const ns = numerosDe(t);
      if (!ns.length) {
        if (/^\d{1,3}$/.test(t)) return repreguntar(PREGUNTA.numeros, `Necesito el número completo como aparece en el registro (por ejemplo 4.4.${t}), no solo el orden.`);
        return invalido(PREGUNTA.numeros);
      }
      const x = entender(t);
      return avanzar({ ...d, nums: ns, ...(d.accion === 'habilitar' && x.que && !d.que ? { que: x.que } : {}) });
    }
    case 'que': {
      const k = elegir(t, QUE.length);
      const que = k ? QUE[k - 1][0] : entender(t).que;
      if (!que) return invalido(PREGUNTA.que(d.nums));
      if (que !== 'cc') {
        const pm = d.nums.filter(esProcesoMenor);
        if (pm.length) {
          return repreguntar(PREGUNTA.que(d.nums), `${unir(pm)} ${pm.length > 1 ? 'son procesos menores' : 'es un proceso menor'} y no ${pm.length > 1 ? 'tienen' : 'tiene'} predecesor. Para ellos solo se puede quitar la casilla Estado CC (opción 1); si necesita otra cosa, escriba 0 y pídalo como consulta para el analista.`);
        }
      }
      return avanzar({ ...d, que });
    }
    case 'predNum': {
      const [n] = numerosDe(t);
      if (!n) return invalido(PREGUNTA.predNum);
      if (esProcesoMenor(n)) return repreguntar(PREGUNTA.predNum, 'Un proceso menor no puede ser predecesor: indique el paso (por ejemplo 4.4.5).');
      const malos = d.nums.filter((x) => x === n || !anterior(n, x));
      if (malos.length) return repreguntar(PREGUNTA.predNum, `Debe ser un paso anterior al ${unir(malos)}.`);
      return avanzar({ ...d, predNum: n });
    }
    case 'decimales': {
      const k = elegir(t, DECIMALES.length);
      if (!k) return invalido(PREGUNTA.decimales);
      return avanzar({ ...d, decimal: DECIMALES[k - 1] });
    }
    case 'confirmar': {
      const k = elegir(t, 2);
      if (k === 2) return avanzar({ flujo: d.flujo, accion: d.accion }, 'De acuerdo, empecemos de nuevo.');
      if (k !== 1) return invalido(CONFIRMAR);
      const r = await registrar(quien, d);
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    case 'tema': {
      const k = elegir(t, TEMAS.length);
      if (!k) return invalido(PREGUNTA.tema);
      return avanzar({ ...d, tema: k });
    }
    case 'opConsulta': {
      const k = elegir(t, 3);
      if (k === 1) return responder('opNumero', PREGUNTA.opNumero, { ...d, material: undefined });
      if (k === 2) return responder('material', PREGUNTA.material, { ...d, op: '' });
      if (k === 3) return avanzar({ ...d, op: '', material: '' });
      return invalido(PREGUNTA.opConsulta);
    }
    case 'descripcion': {
      if (t.length < 10) return responder(paso, `Por favor, deme un poco más de detalle.\n\n${PREGUNTA.descripcion}`);
      const r = await registrar(quien, { ...d, descripcion: t.slice(0, 2000) });
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    default:
      return responder('menu', preguntaActual(), {});
  }
}
