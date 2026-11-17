// Acceso mínimo a la API REST de Supabase (PostgREST), el mismo proyecto que usa status-rmd.
// Se puede cambiar por variables de entorno; por defecto usa el proyecto y la clave pública de index.html.
const URL_POR_DEFECTO = 'https://govkmqahpvnlmllboqsh.supabase.co';

function config() {
  const url = process.env.SUPABASE_URL || URL_POR_DEFECTO;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!clave) throw new Error('Falta SUPABASE_ANON_KEY (o SUPABASE_SERVICE_ROLE_KEY) en las variables de entorno.');
  return { url, clave };
}

export async function sb(ruta, { method = 'GET', body, prefer } = {}) {
  const { url, clave } = config();
  const r = await fetch(`${url}/rest/v1/${ruta}`, {
    method,
    headers: {
      apikey: clave,
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${ruta.split('?')[0]}: ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

export const enc = encodeURIComponent;
