// Acceso mínimo a la API REST de Supabase (PostgREST), el mismo proyecto que usa status-rmd.
// Las tablas del chatbot NO se abren a la clave pública (anon): solo el backend entra, con la clave service_role
// (variable SUPABASE_SERVICE_ROLE_KEY de Vercel, nunca en la página ni en el repo).
const URL_POR_DEFECTO = 'https://govkmqahpvnlmllboqsh.supabase.co';

function config() {
  const url = process.env.SUPABASE_URL || URL_POR_DEFECTO;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
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
