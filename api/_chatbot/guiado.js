// Bot guiado SIN IA (gratis): menús numerados y opciones cerradas. Pedido de Carlos (2026-11-16).
// Solo se escribe texto libre en: código del material, lote, números de orden y la descripción de una consulta.
// El RMD no se pide (Producción no lo tiene a mano): el ejecutor lo ubica con material + etapa y confirma el lote en «Ver OP».
// El estado de cada conversación se guarda en chatbot_conversaciones (columna mensajes = { paso, d }).
import { sb, enc } from './supabase.js';
import { MODO, registrarSolicitud, misSolicitudes } from './solicitudes.js';

const HUELLA = 'guiado-2';

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
  ['Otro cambio en el RMD (pasos, textos, rangos, version nueva...)', 'cambio', 'normal'],
  ['Otra consulta', 'consulta', 'normal'],
];

const FAQ = [
  ['Que es «habilitar un paso»',
    'Es permitir que un paso se registre antes. Se cambia su predecesor (Depende) por un paso anterior que ya se registra en ese momento, o en casos extremos se deja sin predecesor. Lo pides con la opcion 1 del menu.'],
  ['Por que no se cambia el texto de un RMD Autorizado',
    'En un RMD Autorizado no se edita ninguna palabra de sus pasos. Un cambio de texto o de pasos va en una version nueva, que luego se vuelve a autorizar. El predecesor y los decimales si se ajustan en el mismo RMD.'],
  ['Cuantos decimales se usan',
    'Habitual: 3 en cantidades (Numeros, Formula, Entrega, Muestra); 0 en unidades enteras (cajas, folios); 1 en velocidad o temperatura de proceso. Se cambia en el RMD, no en el paso maestro.'],
  ['Cuando llega un cambio a la OP en proceso',
    'Despues de guardar se pulsa «Actualizar RMD en Linea»: asi el cambio llega a la OP que esta en proceso. El sistema lo hace solo al aplicar tu solicitud.'],
  ['Reglas de los textos de los pasos',
    'Van en mayusculas y sin tildes. Se dice CALIDAD EN OPERACIONES (no Control de Calidad), salvo biocarga, la nota del granel y el cierre de Acondicionado con FPRO-250. La casilla PM OP no se marca.'],
  ['Que pasos no llevan predecesor',
    'Rendimiento, Condiciones ambientales y los pasos «Sin tipo de dato». Solo se admite un predecesor por paso.'],
];

const MENU = [
  'Asistente de configuraciones RMD (Documentacion Tecnica). Responde con un numero:',
  '1. Habilitar un paso (cambiar su predecesor)',
  '2. Cambiar los decimales de un dato',
  '3. Consulta o problema para el analista',
  '4. Ver mis solicitudes',
  '5. Preguntas frecuentes',
  '',
  'En cualquier momento: 0 = volver al menu.',
].join('\n');

const lista = (titulo, opciones) => [titulo, ...opciones.map((o, i) => `${i + 1}. ${o}`), '0. Volver al menu'].join('\n');
const elegir = (texto, n) => { const k = Number(String(texto).trim()); return Number.isInteger(k) && k >= 1 && k <= n ? k : null; };
const numero = (texto) => { const m = String(texto).trim().match(/^#?(\d{1,4})$/); return m ? Number(m[1]) : null; };
const SI_NO = '1. Si\n2. No';
const MATERIAL = /^[A-Za-z0-9-]{4,18}$/;
const LOTE = /^[A-Za-z0-9-]{3,15}$/;

const PREGUNTA = {
  material: 'Escribe el codigo del material (el de la OP o del producto).',
  etapa: lista('¿De que etapa es el RMD?', ETAPAS),
  lista: (opc) => lista('¿En que lista esta el paso?', opc.map((x) => x[0])),
  orden: 'Escribe el numero de orden del paso dentro de esa lista (la columna Orden; p. ej. 12).',
  desde: lista('¿Desde que paso debe poder registrarse?', [
    'Desde otro paso anterior de la misma lista',
    'Desde un paso de otra lista',
    'Sin predecesor (solo si el paso es realmente independiente)',
  ]),
  ordenPred: 'Escribe el numero de orden del paso desde el que debe poder registrarse.',
  decimales: lista('¿Cuantos decimales necesita?', DECIMALES.map(String)),
  op: `¿Es para un lote en proceso? (se confirma en Ver OP que el lote este en ese RMD)\n${SI_NO}`,
  opNumero: 'Escribe el numero de lote.',
  tema: lista('¿Que tipo de consulta es?', TEMAS.map((t) => t[0])),
  rmdOpcional: 'Escribe el codigo del material o NO si no aplica.',
  descripcion: 'Describe en un solo mensaje lo que necesitas (paso, que pasa, que esperas).',
};

function nombreLista(valor) {
  return (LISTAS_DECIMAL.find((x) => x[1] === valor) || [valor])[0];
}

function resumen(d) {
  const base = `Material ${d.material} (${d.etapa})${d.op ? `, lote ${d.op}` : ''}, lista ${nombreLista(d.lista)}, paso de orden ${d.orden}`;
  if (d.accion === 'cambiar_predecesor') {
    const destino = d.sin ? 'quedara sin predecesor'
      : `dependera del paso de orden ${d.ordenPred}${d.listaPred && d.listaPred !== d.lista ? ` de la lista ${nombreLista(d.listaPred)}` : ''}`;
    return `${base}: ${destino}.`;
  }
  return `${base}: se configurara con ${d.decimal} decimales.`;
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
  nueva: 'la revisa el analista', lista: 'se aplicara en SAP', ejecutando: 'aplicandose en SAP', ejecutada: 'aplicada en SAP',
  revisar: 'la revisa el analista', rechazada: 'rechazada', resuelta: 'resuelta',
};

async function textoMisSolicitudes(contacto) {
  const filas = await misSolicitudes(contacto, 5);
  if (!filas.length) return 'Aun no tienes solicitudes.';
  return filas.map((s) => `#${s.id} - ${ETIQUETA_ESTADO[s.estado] || s.estado} - ${s.resumen}` +
    (s.respuesta_analista ? `\n   Analista: ${s.respuesta_analista}` : '')).join('\n');
}

async function registrar(quien, d) {
  let input;
  if (d.flujo === 'consulta') {
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
  if (solicitud.estado === 'lista') sigue = 'Se aplicara en SAP en unos minutos (guardar y Actualizar RMD en Linea). Te aviso el resultado por aqui.';
  else if (solicitud.automatica && MODO !== 'automatico') sigue = 'El analista la aprobara y se aplicara sola en SAP. Te aviso por aqui.';
  else sigue = 'El analista de Documentacion Tecnica la revisara y te respondera por aqui.';
  return { solicitud, texto: `Listo, registre tu solicitud #${solicitud.id}. ${sigue}\n\n0. Volver al menu` };
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
  const invalido = (pregunta) => responder(paso, `No entendi esa respuesta.\n\n${pregunta}`);
  // Tras el lote: la consulta pide la descripcion; el cambio sigue con la lista del paso.
  const trasLote = (datos) => datos.flujo === 'consulta'
    ? responder('descripcion', PREGUNTA.descripcion, datos)
    : responder('lista', PREGUNTA.lista(datos.accion === 'configurar_decimal' ? LISTAS_DECIMAL : LISTAS), datos);

  if (t === '0' || /^(menu|menú|hola|buen[oa]s.*|inicio|cancelar|reiniciar)$/i.test(t) || paso === 'menu' && !elegir(t, 5)) {
    return responder('menu', MENU, {});
  }

  switch (paso) {
    case 'menu': {
      const k = elegir(t, 5);
      if (k === 1) return responder('material', `Habilitar un paso.\n\n${PREGUNTA.material}`, { flujo: 'cambio', accion: 'cambiar_predecesor' });
      if (k === 2) return responder('material', `Cambiar decimales.\n\n${PREGUNTA.material}`, { flujo: 'cambio', accion: 'configurar_decimal' });
      if (k === 3) return responder('tema', PREGUNTA.tema, { flujo: 'consulta' });
      if (k === 4) return responder('menu', `${await textoMisSolicitudes(quien.contacto)}\n\n0. Volver al menu`, {});
      return responder('faq', lista('Preguntas frecuentes:', FAQ.map((f) => f[0])), {});
    }
    case 'faq': {
      const k = elegir(t, FAQ.length);
      if (!k) return invalido(lista('Preguntas frecuentes:', FAQ.map((f) => f[0])));
      return responder('faq', `${FAQ[k - 1][1]}\n\nOtra pregunta: escribe su numero (1-${FAQ.length}). 0 = menu.`);
    }
    case 'material':
      if (!MATERIAL.test(t)) return invalido(PREGUNTA.material);
      return responder('etapa', PREGUNTA.etapa, { ...d, material: t.toUpperCase() });
    case 'etapa': {
      const k = elegir(t, ETAPAS.length);
      if (!k) return invalido(PREGUNTA.etapa);
      return responder('op', PREGUNTA.op, { ...d, etapa: ETAPAS[k - 1] });
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
        if (d.orden <= 1) return invalido(`El paso 1 no tiene pasos anteriores en su lista.\n\n${PREGUNTA.desde}`);
        return responder('ordenPred', PREGUNTA.ordenPred, { ...d, listaPred: d.lista, sin: false });
      }
      if (k === 2) return responder('listaPred', PREGUNTA.lista(LISTAS).replace('¿En que lista esta el paso?', '¿En que lista esta ese paso?'), { ...d, sin: false });
      if (k === 3) {
        d = { ...d, sin: true };
        return responder('confirmar', `Quitar el predecesor es la excepcion: Documentacion Tecnica lo revisara si el paso no es condicional o en paralelo.\n\nResumen: ${resumen(d)}\n\n1. Confirmar\n2. Corregir (empezar de nuevo)\n0. Cancelar`, d);
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
      if (d.listaPred === d.lista && n >= d.orden) return invalido(`Debe ser un paso anterior al ${d.orden}.\n\n${PREGUNTA.ordenPred}`);
      d = { ...d, ordenPred: n };
      return responder('confirmar', `Resumen: ${resumen(d)}\n\n1. Confirmar\n2. Corregir (empezar de nuevo)\n0. Cancelar`, d);
    }
    case 'decimales': {
      const k = elegir(t, DECIMALES.length);
      if (!k) return invalido(PREGUNTA.decimales);
      d = { ...d, decimal: DECIMALES[k - 1] };
      return responder('confirmar', `Resumen: ${resumen(d)}\n\n1. Confirmar\n2. Corregir (empezar de nuevo)\n0. Cancelar`, d);
    }
    case 'op': {
      const k = elegir(t, 2);
      if (k === 1) return responder('opNumero', PREGUNTA.opNumero);
      if (k !== 2) return invalido(PREGUNTA.op);
      return trasLote({ ...d, op: '' });
    }
    case 'opNumero': {
      if (!LOTE.test(t)) return invalido(PREGUNTA.opNumero);
      return trasLote({ ...d, op: t.toUpperCase() });
    }
    case 'confirmar': {
      const k = elegir(t, 2);
      if (k === 2) return responder('material', PREGUNTA.material, { flujo: d.flujo, accion: d.accion });
      if (k !== 1) return invalido('1. Confirmar\n2. Corregir\n0. Cancelar');
      const r = await registrar(quien, d);
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    case 'tema': {
      const k = elegir(t, TEMAS.length);
      if (!k) return invalido(PREGUNTA.tema);
      return responder('rmdOpcional', PREGUNTA.rmdOpcional, { ...d, tema: k });
    }
    case 'rmdOpcional':
      if (/^no$/i.test(t)) return responder('op', PREGUNTA.op, { ...d, material: '' });
      if (!MATERIAL.test(t)) return invalido(PREGUNTA.rmdOpcional);
      return responder('etapa', PREGUNTA.etapa, { ...d, material: t.toUpperCase() });
    case 'descripcion': {
      if (t.length < 10) return invalido(PREGUNTA.descripcion);
      const r = await registrar(quien, { ...d, descripcion: t.slice(0, 2000) });
      return responder('menu', r.texto, {}, [r.solicitud]);
    }
    default:
      return responder('menu', MENU, {});
  }
}
