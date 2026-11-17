// Bot guiado SIN IA (gratis): menús numerados y opciones cerradas. Pedido de Carlos (2026-11-16).
// Trata de usted, con tono cordial y sin emojis (pedido de Carlos, 2026-11-17). Entiende saludos y pedidos escritos con
// palabras comunes («PDF master del lote L2611A») por palabras clave, sin IA.
// Solo se escribe texto libre en: código del material, lote, números de orden y la descripción de una consulta.
// El RMD no se pide (Producción no lo tiene a mano): con el lote basta (el ejecutor lo busca en «Ver OP»); sin lote,
// material + etapa (última versión Autorizada).
// El estado de cada conversación se guarda en chatbot_conversaciones (columna mensajes = { paso, d }).
import { sb, enc } from './supabase.js';
import { MODO, registrarSolicitud, misSolicitudes } from './solicitudes.js';

const HUELLA = 'guiado-3';

const ETAPAS = ['FABRICACION', 'ENVASE', 'ACONDICIONADO', 'RECUBRIMIENTO', 'INSPECCION'];

// Listas (estructura > etiqueta) que se ofrecen. Rendimiento solo para decimales: no lleva predecesor.
const LISTAS = [
  ['PRECAUCIONES', 'PRECAUCIONES'],
  ['NOTAS IMPORTANTES', 'NOTAS IMPORTANTES DURANTE EL PROCESO'],
  ['DOCUMENTACION', 'PROCEDIMIENTO>DOCUMENTACION'],
  ['PREPARACION DEL MATERIAL', 'PROCEDIMIENTO>PREPARACION DEL MATERIAL'],
  ['PREPARACION DE MAQUINAS', 'PROCEDIMIENTO>PREPARACION DE MAQUINAS'],
  ['FABRICACION', 'PROCEDIMIENTO>FABRICACION'],
  ['ENVASE', 'PROCEDIMIENTO>ENVASE'],
  ['ACONDICIONADO', 'PROCEDIMIENTO>ACONDICIONADO'],
  ['RECUBRIMIENTO', 'PROCEDIMIENTO>RECUBRIMIENTO'],
];
const LISTAS_DECIMAL = [...LISTAS, ['RENDIMIENTO', 'PROCEDIMIENTO>RENDIMIENTO']];
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

const FAQ = [
  ['¿Qué es «habilitar un paso»?',
    'Es permitir que un paso se registre antes. Se cambia su predecesor (Depende) por un paso anterior que ya se registra en ese momento o, en casos extremos, se deja sin predecesor. Puede pedirlo con la opción 1 del menú.'],
  ['¿Por qué no se cambia el texto de un RMD Autorizado?',
    'En un RMD Autorizado no se edita ninguna palabra de sus pasos. Un cambio de texto o de pasos va en una versión nueva, que luego se vuelve a autorizar. El predecesor y los decimales sí se ajustan en el mismo RMD.'],
  ['¿Cuántos decimales se usan?',
    'Lo habitual es 3 en cantidades (números, fórmula, entrega, muestra), 0 en unidades enteras (cajas, folios) y 1 en velocidad o temperatura de proceso. Se cambia en el RMD, no en el paso maestro.'],
  ['¿Cuándo llega un cambio a la OP en proceso?',
    'Después de guardar se pulsa «Actualizar RMD en Línea», y así el cambio llega a la OP que está en proceso. El sistema lo hace solo al aplicar su solicitud.'],
  ['¿Qué reglas siguen los textos de los pasos?',
    'Van en mayúsculas y sin tildes. Se dice CALIDAD EN OPERACIONES (no Control de Calidad), salvo biocarga, la nota del granel y el cierre de Acondicionado con FPRO-250. La casilla PM OP no se marca.'],
  ['¿Qué pasos no llevan predecesor?',
    'Rendimiento, Condiciones ambientales y los pasos «Sin tipo de dato». Solo se admite un predecesor por paso.'],
  ['¿Cómo recibo la plantilla o el PDF del master?',
    'Elija la opción 3 o 4 del menú e indique el material y la etapa (o el lote). Le confirmo cuál es el RMD y en unos minutos le envío por aquí un enlace para descargarlo, válido por 7 días.'],
];

const OPCIONES_MENU = [
  'Habilitar un paso (cambiar su predecesor)',
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
    'También puede escribirme lo que necesita, por ejemplo: «PDF del master del lote L2611A».'].join('\n');
}

const lista = (titulo, opciones) => [titulo, ...opciones.map((o, i) => `${i + 1}. ${o}`), '0. Volver al menú'].join('\n');
const elegir = (texto, n) => { const k = Number(String(texto).trim()); return Number.isInteger(k) && k >= 1 && k <= n ? k : null; };
const numero = (texto) => { const m = String(texto).trim().match(/^#?(\d{1,4})$/); return m ? Number(m[1]) : null; };
const MATERIAL = /^[A-Za-z0-9-]{4,18}$/;
const LOTE = /^[A-Za-z0-9-]{3,15}$/;
const CONFIRMAR = '1. Confirmar\n2. Corregir (empezar de nuevo)\n0. Cancelar';

const PREGUNTA = {
  material: 'Por favor, escriba el código del material (el de la OP o del producto).',
  etapa: lista('¿De qué etapa es el RMD?', ETAPAS),
  lista: (opc) => lista('¿En qué lista está el paso?', opc.map((x) => x[0])),
  orden: 'Escriba el número de orden del paso dentro de esa lista (la columna Orden; por ejemplo, 12).',
  desde: lista('¿Desde qué paso debe poder registrarse?', [
    'Desde otro paso anterior de la misma lista',
    'Desde un paso de otra lista',
    'Sin predecesor (solo si el paso es realmente independiente)',
  ]),
  ordenPred: 'Escriba el número de orden del paso desde el que debe poder registrarse.',
  decimales: lista('¿Cuántos decimales necesita?', DECIMALES.map(String)),
  op: '¿Tiene el número de lote?\n1. Sí (con el lote basta)\n2. No (le pido el material y la etapa)',
  // Plantilla y PDF del master: primero material + etapa (pedido de Carlos, 2026-11-17); el lote es la segunda opción.
  ubicar: '¿Cómo ubico el RMD?\n1. Con el código del material y la etapa\n2. Con el número de lote',
  opNumero: 'Por favor, escriba el número de lote.',
  tema: lista('¿Qué tipo de consulta es?', TEMAS.map((t) => t[0])),
  rmdOpcional: 'Escriba el código del material, o NO si no aplica.',
  descripcion: 'Cuénteme en un solo mensaje lo que necesita (qué paso, qué ocurre y qué espera).',
};

// ---------- texto libre: saludos y pedidos con palabras comunes (sin IA) ----------
const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SALUDO = /^(hola|buen[oa]s?( dias| tardes| noches)?|saludos|que tal|buen dia|alo|hey|ola)\b/;
const GRACIAS = /^(muchas )?gracias\b|^ok,? gracias|^listo,? gracias|^perfecto,? gracias|^mil gracias/;
const DESPEDIDA = /^(chau|adios|hasta luego|nos vemos|bye)\b/;

const INTENCIONES = [
  ['pdf', /\bpdf\b|\bmaster\b|\bmaestro\b/],
  ['plantilla', /plantilla|borrador/],
  ['estado', /\bestado\b|\bstatus\b|\bestatus\b|ultima version|version vigente|\bvigente\b|en que version|esta autorizad/],
  ['habilitar', /habilit|predecesor|\bdepende\b|no (me )?deja (registrar|anotar)|paso bloquead|desbloque/],
  ['decimales', /decimal/],
  ['mis', /mis solicitudes|mi solicitud|como va (mi|el) (pedido|solicitud)|seguimiento/],
  ['consulta', /\berror\b|problema|\bfalla|no carga|detenid|no funciona|no responde|consulta|ayuda con/],
  ['faq', /pregunta(s)? frecuente/],
];

function entender(texto) {
  const t = plano(texto);
  const intencion = (INTENCIONES.find(([, re]) => re.test(t)) || [null])[0];
  const lote = (String(texto).match(/\blote\s*(?:n(?:ro|°|º)?\.?\s*)?[:#]?\s*([A-Za-z0-9-]{3,15})\b/i) || [])[1];
  const material = (String(texto).match(/\bmaterial\s*[:#]?\s*([A-Za-z0-9-]{4,18})\b/i) || [])[1];
  const etapa = ETAPAS.find((e) => new RegExp(`\\b${e.toLowerCase()}\\b`).test(t));
  return {
    intencion, lote: lote && /\d/.test(lote) ? lote.toUpperCase() : '', material: material && /\d/.test(material) ? material.toUpperCase() : '',
    etapa: material ? etapa || '' : '', saludo: SALUDO.test(t), gracias: GRACIAS.test(t), despedida: DESPEDIDA.test(t),
  };
}

function nombreLista(valor) {
  return (LISTAS_DECIMAL.find((x) => x[1] === valor) || [valor])[0];
}

function donde(d) {
  return d.material ? `material ${d.material} (${d.etapa})${d.op ? `, lote ${d.op}` : ''}` : `lote ${d.op}`;
}

function resumen(d) {
  const base = `${donde(d).replace(/^./, (c) => c.toUpperCase())}, lista ${nombreLista(d.lista)}, paso de orden ${d.orden}`;
  if (d.accion === 'cambiar_predecesor') {
    const destino = d.sin ? 'quedará sin predecesor'
      : `dependerá del paso de orden ${d.ordenPred}${d.listaPred && d.listaPred !== d.lista ? ` de la lista ${nombreLista(d.listaPred)}` : ''}`;
    return `${base}: ${destino}.`;
  }
  return `${base}: se configurará con ${d.decimal} decimales.`;
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
      tipo, prioridad: d.op ? 'alta' : prioridad, resumen: `${titulo}${d.material ? ` - material ${d.material} ${d.etapa}` : ''}`,
      material: d.material || undefined, etapa: d.etapa || undefined, op_lote: d.op || undefined, detalle: d.descripcion, cambios: [],
    };
  } else {
    const c = { accion: d.accion, lista: d.lista, paso: '', orden_paso: d.orden };
    if (d.accion === 'cambiar_predecesor') {
      if (d.sin) c.sin_predecesor = true;
      else { c.predecesor_orden = d.ordenPred; if (d.listaPred && d.listaPred !== d.lista) c.predecesor_lista = d.listaPred; }
    } else c.decimal = d.decimal;
    input = {
      tipo: 'cambio', prioridad: d.op ? 'alta' : 'normal',
      resumen: d.accion === 'cambiar_predecesor' ? `Habilitar paso ${d.orden} de ${nombreLista(d.lista)}` : `Decimales del paso ${d.orden} de ${nombreLista(d.lista)}: ${d.decimal}`,
      material: d.material, etapa: d.etapa, op_lote: d.op || undefined, detalle: resumen(d), cambios: [c],
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

// Arranca un flujo desde el menú (por número o por lo que se entendió del texto libre).
function iniciar(intencion, x = {}) {
  const conLote = x.lote ? { op: x.lote } : x.material && x.etapa ? { op: '', material: x.material, etapa: x.etapa } : null;
  const flujos = {
    habilitar: [{ flujo: 'cambio', accion: 'cambiar_predecesor' }, 'Con gusto le ayudo a habilitar un paso.'],
    decimales: [{ flujo: 'cambio', accion: 'configurar_decimal' }, 'Con gusto le ayudo a cambiar los decimales.'],
    plantilla: [{ flujo: 'lectura', lectura: 'plantilla' }, 'Con gusto le preparo la plantilla para Producción.'],
    pdf: [{ flujo: 'lectura', lectura: 'pdf' }, 'Con gusto le preparo el PDF del master.'],
    estado: [{ flujo: 'lectura', lectura: 'estado' }, 'Con gusto le consulto el estado del RMD.'],
  };
  const [d, intro] = flujos[intencion];
  return { d: conLote ? { ...d, ...conLote } : d, intro, listo: Boolean(conLote) };
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
  // Tras ubicar el RMD (lote, o material + etapa): la lectura se registra ya; la consulta pide la descripción;
  // el cambio sigue con la lista del paso.
  const trasLote = async (datos) => {
    if (datos.flujo === 'lectura') {
      const r = await registrar(quien, datos);
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    if (datos.flujo === 'consulta') return responder('descripcion', PREGUNTA.descripcion, datos);
    return responder('lista', PREGUNTA.lista(datos.accion === 'configurar_decimal' ? LISTAS_DECIMAL : LISTAS), datos);
  };
  const arrancar = async (intencion, x) => {
    if (intencion === 'mis') return responder('menu', `${await textoMisSolicitudes(quien.contacto)}\n\n0. Volver al menú`, {});
    if (intencion === 'faq') return responder('faq', lista('Preguntas frecuentes:', FAQ.map((f) => f[0])), {});
    if (intencion === 'consulta') return responder('tema', PREGUNTA.tema, { flujo: 'consulta' });
    const r = iniciar(intencion, x);
    if (r.listo) return trasLote(r.d);
    if (r.d.lectura === 'plantilla' || r.d.lectura === 'pdf') return responder('ubicar', `${r.intro}\n\n${PREGUNTA.ubicar}`, r.d);
    return responder('op', `${r.intro}\n\n${PREGUNTA.op}`, r.d);
  };
  // Respuesta que no encaja con la pregunta: si se entiende un pedido escrito, se atiende; si no, se repregunta.
  const invalido = (pregunta) => {
    const x = entender(t);
    if (x.intencion && t.length > 3) return arrancar(x.intencion, x);
    return responder(paso, `Disculpe, no le entendí.\n\n${pregunta}`);
  };

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
      return arrancar(['habilitar', 'decimales', 'plantilla', 'pdf', 'estado', 'consulta', 'mis', 'faq'][k - 1], {});
    }
    case 'faq': {
      const k = elegir(t, FAQ.length);
      if (!k) return invalido(lista('Preguntas frecuentes:', FAQ.map((f) => f[0])));
      return responder('faq', `${FAQ[k - 1][1]}\n\nSi tiene otra pregunta, escriba su número (1-${FAQ.length}).\n0. Volver al menú`);
    }
    case 'material':
      if (!MATERIAL.test(t) || !/\d/.test(t)) return invalido(PREGUNTA.material);
      return responder('etapa', PREGUNTA.etapa, { ...d, material: t.toUpperCase() });
    case 'etapa': {
      const k = elegir(t, ETAPAS.length) || ETAPAS.indexOf(plano(t).toUpperCase()) + 1;
      if (!k) return invalido(PREGUNTA.etapa);
      return trasLote({ ...d, etapa: ETAPAS[k - 1] });
    }
    case 'lista': {
      const opc = d.accion === 'configurar_decimal' ? LISTAS_DECIMAL : LISTAS;
      const k = elegir(t, opc.length);
      if (!k) return invalido(PREGUNTA.lista(opc));
      return responder('orden', PREGUNTA.orden, { ...d, lista: opc[k - 1][1] });
    }
    case 'orden': {
      const n = numero(t);
      if (!n) return invalido(PREGUNTA.orden);
      if (d.accion === 'configurar_decimal') return responder('decimales', PREGUNTA.decimales, { ...d, orden: n });
      return responder('desde', PREGUNTA.desde, { ...d, orden: n });
    }
    case 'desde': {
      const k = elegir(t, 3);
      if (k === 1) {
        if (d.orden <= 1) return responder(paso, `El paso 1 no tiene pasos anteriores en su lista.\n\n${PREGUNTA.desde}`);
        return responder('ordenPred', PREGUNTA.ordenPred, { ...d, listaPred: d.lista, sin: false });
      }
      if (k === 2) return responder('listaPred', PREGUNTA.lista(LISTAS).replace('¿En qué lista está el paso?', '¿En qué lista está ese paso?'), { ...d, sin: false });
      if (k === 3) {
        d = { ...d, sin: true };
        return responder('confirmar', `Quitar el predecesor es la excepción: Documentación Técnica lo revisará si el paso no es condicional o en paralelo.\n\nResumen: ${resumen(d)}\n\n${CONFIRMAR}`, d);
      }
      return invalido(PREGUNTA.desde);
    }
    case 'listaPred': {
      const k = elegir(t, LISTAS.length);
      if (!k) return invalido(PREGUNTA.lista(LISTAS));
      return responder('ordenPred', PREGUNTA.ordenPred, { ...d, listaPred: LISTAS[k - 1][1] });
    }
    case 'ordenPred': {
      const n = numero(t);
      if (!n) return invalido(PREGUNTA.ordenPred);
      if (d.listaPred === d.lista && n >= d.orden) return responder(paso, `Debe ser un paso anterior al ${d.orden}.\n\n${PREGUNTA.ordenPred}`);
      d = { ...d, ordenPred: n };
      return responder('confirmar', `Resumen: ${resumen(d)}\n\n${CONFIRMAR}`, d);
    }
    case 'decimales': {
      const k = elegir(t, DECIMALES.length);
      if (!k) return invalido(PREGUNTA.decimales);
      d = { ...d, decimal: DECIMALES[k - 1] };
      return responder('confirmar', `Resumen: ${resumen(d)}\n\n${CONFIRMAR}`, d);
    }
    case 'op': {
      const k = elegir(t, 2);
      if (k === 1) return responder('opNumero', PREGUNTA.opNumero);
      if (k !== 2) {
        if (LOTE.test(t) && /\d/.test(t)) return trasLote({ ...d, op: t.toUpperCase() }); // escribió el lote directamente
        return invalido(PREGUNTA.op);
      }
      d = { ...d, op: '' };
      if (d.flujo === 'consulta') return responder('rmdOpcional', PREGUNTA.rmdOpcional, d);
      return responder('material', PREGUNTA.material, d);
    }
    case 'ubicar': {
      const k = elegir(t, 2);
      if (k === 1) return responder('material', PREGUNTA.material, { ...d, op: '' });
      if (k === 2) return responder('opNumero', PREGUNTA.opNumero);
      if (MATERIAL.test(t) && /\d/.test(t)) return responder('etapa', PREGUNTA.etapa, { ...d, op: '', material: t.toUpperCase() }); // escribió el material
      return invalido(PREGUNTA.ubicar);
    }
    case 'opNumero': {
      const m = t.match(/([A-Za-z0-9-]{3,15})\s*$/);
      if (!m || !LOTE.test(m[1]) || !/\d/.test(m[1])) return invalido(PREGUNTA.opNumero);
      return trasLote({ ...d, op: m[1].toUpperCase() });
    }
    case 'confirmar': {
      const k = elegir(t, 2);
      if (k === 2) return responder('op', PREGUNTA.op, { flujo: d.flujo, accion: d.accion });
      if (k !== 1) return invalido(CONFIRMAR);
      const r = await registrar(quien, d);
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    case 'tema': {
      const k = elegir(t, TEMAS.length);
      if (!k) return invalido(PREGUNTA.tema);
      return responder('op', PREGUNTA.op, { ...d, tema: k });
    }
    case 'rmdOpcional':
      if (/^no$/i.test(t)) return responder('descripcion', PREGUNTA.descripcion, { ...d, material: '' });
      if (!MATERIAL.test(t)) return invalido(PREGUNTA.rmdOpcional);
      return responder('etapa', PREGUNTA.etapa, { ...d, material: t.toUpperCase() });
    case 'descripcion': {
      if (t.length < 10) return responder(paso, `Por favor, deme un poco más de detalle.\n\n${PREGUNTA.descripcion}`);
      const r = await registrar(quien, { ...d, descripcion: t.slice(0, 2000) });
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    default:
      return responder('menu', menu(quien, 'menu'), {});
  }
}
