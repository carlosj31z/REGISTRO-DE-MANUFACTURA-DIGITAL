# CSS de Tailwind ya compilado

`index.html` ya no usa `cdn.tailwindcss.com` (compilaba las clases en el navegador en cada apertura). El CSS va dentro de
`<style id="tailwind-compilado">`, al final del `<head>`.

Si agregas al `index.html` una clase de Tailwind que la página no usaba antes (por ejemplo `bg-teal-700/40`), vuelve a
generarlo y pégalo en ese `<style>`:

```bash
cd herramientas/tailwind
npx tailwindcss@3.4.17 -c tailwind.config.js -i entrada.css -o salida.css --minify
node pegar.mjs   # reemplaza el contenido de <style id="tailwind-compilado"> con salida.css
```

`tailwind.config.js` tiene la misma paleta propia que antes iba en el `<script>` del CDN (colores a variables CSS).
