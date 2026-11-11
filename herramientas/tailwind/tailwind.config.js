// Misma configuración que antes iba en el <script> de cdn.tailwindcss.com (index.html): paleta propia resuelta a variables CSS
// "R G B" (definidas en el <style> principal para modo oscuro y redefinidas bajo html[data-theme="light"]).
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const fam = (name) => Object.fromEntries(SHADES.map((n) => [n, `rgb(var(--c-${name}-${n}) / <alpha-value>)`]));
const ink = fam('slate'), brass = fam('brass'), copper = fam('copper'),
    verm = fam('verm'), sage = fam('sage'), petrol = fam('petrol'), plum = fam('plum');
module.exports = {
    content: ['../../index.html'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                slate: ink, gray: ink, zinc: ink, neutral: ink, stone: ink,
                amber: brass, yellow: brass,
                orange: copper,
                red: verm, rose: verm,
                emerald: sage, green: sage, teal: sage, lime: sage,
                blue: petrol, sky: petrol, cyan: petrol, indigo: petrol,
                purple: plum, violet: plum, fuchsia: plum, pink: plum,
            },
            fontFamily: { sans: ['Inter', 'sans-serif'] },
        },
    },
};
