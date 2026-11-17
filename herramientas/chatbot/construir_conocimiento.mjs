// Arma la base de conocimiento del asistente (api/_chatbot/conocimiento.js) desde chatbot/conocimiento/*.md.
//
//   node herramientas/chatbot/construir_conocimiento.mjs
//   node herramientas/chatbot/construir_conocimiento.mjs --desde ../AUTOMATIZACION-DE-RMD   (copia antes las guías al día)
//
// Orden: primero jerga_y_reglas.md (manda sobre lo demás), luego las guías técnicas en orden alfabético.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const carpeta = path.join(raiz, 'chatbot', 'conocimiento');
const GUIAS = ['como_se_configura_un_rmd.md', 'configurar_rmd_verificado.md', 'flujo_y_revisiones.md', 'homologacion_rmd.md'];

const i = process.argv.indexOf('--desde');
if (i > 0) {
  const origen = path.resolve(process.argv[i + 1], 'docs');
  for (const g of GUIAS) {
    fs.copyFileSync(path.join(origen, g), path.join(carpeta, g));
    console.log('copiado', g);
  }
}

const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.md')).sort((a, b) =>
  a === 'jerga_y_reglas.md' ? -1 : b === 'jerga_y_reglas.md' ? 1 : a.localeCompare(b));
const partes = archivos.map((f) => `<<< ${f} >>>\n${fs.readFileSync(path.join(carpeta, f), 'utf8').trim()}\n`);
const texto = partes.join('\n');
const salida = path.join(raiz, 'api', '_chatbot', 'conocimiento.js');
fs.writeFileSync(salida,
  '// GENERADO por herramientas/chatbot/construir_conocimiento.mjs desde chatbot/conocimiento/*.md. No editar a mano.\n' +
  `export const CONOCIMIENTO = ${JSON.stringify(texto)};\n`);
console.log(`${archivos.length} archivos, ${texto.length.toLocaleString('es')} caracteres → ${path.relative(raiz, salida)}`);
