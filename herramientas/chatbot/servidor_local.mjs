// Servidor local para probar el chat web sin Vercel:  node herramientas/chatbot/servidor_local.mjs [--simulado] [--puerto 3000]
// Con --simulado no hace falta ninguna clave (Supabase en memoria y respuestas guionadas). Sin él usa las variables de
// entorno reales (ANTHROPIC_API_KEY, SUPABASE_ANON_KEY, …). Abre http://localhost:3000/chatbot/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
if (process.argv.includes('--simulado')) {
  process.env.CHATBOT_CLAVE_ANALISTA ||= 'analista';
  (await import('./simulado.mjs')).instalar();
}
const { default: chatbot } = await import('../../api/chatbot.js');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chatbot') {
    let crudo = ''; for await (const t of req) crudo += t;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (d) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d)); return res; };
    req.body = crudo ? JSON.parse(crudo) : {};
    return chatbot(req, res);
  }
  const archivo = path.join(raiz, url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
  if (!archivo.startsWith(raiz) || !fs.existsSync(archivo)) { res.statusCode = 404; return res.end('No existe'); }
  res.setHeader('Content-Type', archivo.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain');
  fs.createReadStream(archivo).pipe(res);
}).listen(Number(arg('--puerto', 3000)), () => console.log(`http://localhost:${arg('--puerto', 3000)}/chatbot/`));
