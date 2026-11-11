// Pega salida.css dentro de <style id="tailwind-compilado"> del index.html.
import fs from 'node:fs';
const ruta = new URL('../../index.html', import.meta.url);
const html = fs.readFileSync(ruta, 'utf8');
const css = fs.readFileSync(new URL('./salida.css', import.meta.url), 'utf8').trim();
const re = /(<style id="tailwind-compilado">\n)[\s\S]*?(\n    <\/style>)/;
if (!re.test(html)) throw new Error('No encontré <style id="tailwind-compilado"> en index.html');
fs.writeFileSync(ruta, html.replace(re, (m, a, b) => a + css + b));
console.log('Listo:', css.length, 'caracteres de CSS');
