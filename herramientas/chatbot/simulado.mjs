// Simulación para probar el asistente SIN internet ni claves: reemplaza fetch con
//  - una Supabase en memoria (PostgREST básico: eq, in, order, limit, POST, PATCH, DELETE, merge-duplicates),
//  - la API de Claude con respuestas guionadas (o, si hay ANTHROPIC_API_KEY y CHATBOT_REAL=1, la de verdad),
//  - WhatsApp y GitHub, que solo se anotan en `enviados`.
export const tablas = { chatbot_solicitudes: [], chatbot_conversaciones: [], chatbot_mensajes_vistos: [] };
export const enviados = [];
const CLAVES = { chatbot_conversaciones: 'contacto', chatbot_mensajes_vistos: 'id' };
let secuencia = 0;

function filtrar(filas, params) {
  let out = filas;
  for (const [k, v] of params) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const [op, ...resto] = v.split('.');
    const val = resto.join('.');
    if (op === 'eq') out = out.filter((f) => String(f[k]) === val);
    if (op === 'in') { const set = val.replace(/^\(|\)$/g, '').split(','); out = out.filter((f) => set.includes(String(f[k]))); }
  }
  const orden = params.get('order');
  if (orden) {
    const claves = orden.split(',').map((x) => x.split('.'));
    out = [...out].sort((a, b) => { for (const [c, d] of claves) { if (a[c] < b[c]) return d === 'desc' ? 1 : -1; if (a[c] > b[c]) return d === 'desc' ? -1 : 1; } return 0; });
  }
  if (params.get('limit')) out = out.slice(0, Number(params.get('limit')));
  return out;
}

function supabase(url, init) {
  const u = new URL(url);
  const tabla = u.pathname.split('/').pop();
  const filas = tablas[tabla];
  const metodo = init?.method || 'GET';
  const cuerpo = init?.body ? JSON.parse(init.body) : null;
  const prefer = init?.headers?.Prefer || '';
  const resp = (d, s = 200) => new Response(d === null ? null : JSON.stringify(d), { status: s });
  if (metodo === 'GET') return resp(filtrar(filas, u.searchParams));
  if (metodo === 'POST') {
    const clave = CLAVES[tabla];
    const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
    const creadas = [];
    for (const c of lista) {
      const existente = clave && filas.find((f) => f[clave] === c[clave]);
      if (existente && !prefer.includes('merge-duplicates')) return resp({ message: 'duplicate key' }, 409);
      if (existente) { Object.assign(existente, c); creadas.push(existente); continue; }
      const fila = { ...(tabla === 'chatbot_solicitudes' ? { id: ++secuencia, creado: new Date().toISOString(), estado: 'nueva' } : {}), ...c };
      filas.push(fila); creadas.push(fila);
    }
    return resp(prefer.includes('return=representation') ? creadas : null, 201);
  }
  const elegidas = filtrar(filas, u.searchParams);
  if (metodo === 'PATCH') { elegidas.forEach((f) => Object.assign(f, cuerpo)); return resp(prefer.includes('return=representation') ? elegidas : null); }
  if (metodo === 'DELETE') { tablas[tabla] = filas.filter((f) => !elegidas.includes(f)); return resp(null, 204); }
  return resp({ message: 'no soportado' }, 400);
}

// ---- Claude guionado: decide por el último mensaje de la persona ----
function ultimoTextoDePersona(mensajes) {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.role !== 'user') continue;
    if (typeof m.content === 'string') return { texto: m.content, i };
    if (m.content.some((b) => b.type === 'tool_result')) return { herramienta: true, i };
  }
  return { texto: '' };
}
let idHerramienta = 0;
function mensajeClaude(contenido, stop = 'end_turn') {
  return { id: 'msg_sim', type: 'message', role: 'assistant', model: 'simulado', content: contenido, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
}
export function claudeGuionado(peticion) {
  const u = ultimoTextoDePersona(peticion.messages);
  if (u.herramienta) return mensajeClaude([{ type: 'text', text: 'Listo, registré tu solicitud #1. Se aplicará en SAP en unos minutos y te confirmo el resultado por aquí.' }]);
  const t = (u.texto || '').toLowerCase();
  if (/confirmo|^s[ií]\b/.test(t)) {
    return mensajeClaude([
      { type: 'thinking', thinking: '', signature: 'sim' },
      { type: 'tool_use', id: `toolu_${++idHerramienta}`, name: 'registrar_solicitud', input: {
        tipo: 'cambio', prioridad: 'alta', resumen: 'Habilitar paso TAMIZAR desde el inicio de fabricacion', rmd: '2202609013',
        planta: 'LIMA', etapa: 'FABRICACION', op_lote: '2100033070', detalle: 'Producción no puede registrar el tamizado hasta terminar la mezcla; quiere que dependa del inicio de fabricación.',
        cambios: [{ accion: 'cambiar_predecesor', lista: 'PROCEDIMIENTO>FABRICACION', paso: 'TAMIZAR', predecesor: 'FECHA / HORA INICIO DE LA FABRICACION' }] } },
    ], 'tool_use');
  }
  if (/habilit/.test(t)) return mensajeClaude([{ type: 'text', text: '«Habilitar el paso» = que dependa de un paso anterior que ya se registra (o, en casos extremos, que quede sin predecesor).\n¿Desde qué paso debería poder registrarse el tamizado? Por ejemplo, desde «FECHA / HORA INICIO DE LA FABRICACION».' }]);
  if (/desde|inicio/.test(t)) return mensajeClaude([{ type: 'text', text: 'Resumen: en el RMD 2202609013 (PROCEDIMIENTO > FABRICACION), el paso «TAMIZAR» pasará a depender de «FECHA / HORA INICIO DE LA FABRICACION», y luego se pulsará «Actualizar RMD en Línea» para la OP en proceso. ¿Confirmas?' }]);
  return mensajeClaude([{ type: 'text', text: 'Hola, ¿en qué te ayudo con la configuración de un RMD?' }]);
}

export function instalar({ real = false } = {}) {
  const fetchReal = globalThis.fetch;
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'simulada';
  process.env.ANTHROPIC_API_KEY ||= 'sk-simulada';
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('.supabase.co/rest/v1/')) return supabase(u, init);
    if (u.includes('graph.facebook.com')) { enviados.push({ a: 'whatsapp', cuerpo: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); }
    if (u.includes('api.github.com')) { enviados.push({ a: 'github', url: u, cuerpo: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
    if (u.includes('api.anthropic.com') && !real) {
      const pet = JSON.parse(init.body);
      enviados.push({ a: 'claude', modelo: pet.model, herramientas: pet.tools.map((x) => x.name), mensajes: pet.messages.length });
      return new Response(JSON.stringify(claudeGuionado(pet)), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_sim' } });
    }
    return fetchReal(url, init);
  };
}
