"""Arma la plantilla del «PPT para jefatura» (marcadores {{...}}) desde el PPTX que Carlos presentó a jefatura y le aprobaron
(STATUS_RMD_2026-11-17_FINAL.pptx, 23/11/2026): 1 portada · 2 status general · 3 Ruta 1 P1+P2 · 4 Ruta 2 P1+P2 ·
5 pendientes por planta · 6 cierre. Todo queda igual al original; solo los números pasan a marcadores que llena la página.

Uso: python construir_plantilla_jefatura.py REFERENCIA.pptx SALIDA.pptx [index.html]
Con index.html, reemplaza (o agrega) la constante STATUS_RMD_JEFATURA_B64 en la página.
"""
import base64, io, re, sys, zipfile
from pptx import Presentation

REF, SALIDA = sys.argv[1], sys.argv[2]
INDEX = sys.argv[3] if len(sys.argv) > 3 else None
p = Presentation(REF)
S = list(p.slides)
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'


def todas(slide, nombre):
    r = [x for x in slide.shapes if x.name == nombre]
    if not r: raise KeyError(nombre)
    return r


def sh(slide, nombre, i=0):
    return todas(slide, nombre)[i]


def runs(shape, textos):
    """Reemplaza los runs del cuadro en orden (todos los párrafos). None = se deja; sobran runs → se borran."""
    rs = [r for para in shape.text_frame.paragraphs for r in para.runs]
    assert len(rs) >= len(textos), (shape.name, [r.text for r in rs], textos)
    for r, t in zip(rs, textos):
        if t is not None: r.text = t
    for r in rs[len(textos):]: r._r.getparent().remove(r._r)


def celda(cell, t, color=None):
    rs = cell.text_frame.paragraphs[0].runs
    rs[0].text = t
    for r in rs[1:]: r._r.getparent().remove(r._r)
    if color:
        clr = rs[0]._r.find(f'{A}rPr/{A}solidFill/{A}srgbClr')
        clr.set('val', color)


# Lámina 1: fecha de corte.
runs(sh(S[0], 'CuadroTexto 6'), [None, '{{FECHA_ISO}}'])

# Lámina 2: status general (31/10 → Programa / Otros / Caracterizaciones → corte).
s = S[1]
runs(sh(s, 'Subtitulo'), ['corte {{FECHA_CORTA}}'])
runs(sh(s, 'Fecha cierre'), ['{{J_FECHA_ANT}}'])
runs(sh(s, 'Pendientes cierre'), [None, '{{J_PEND_ANT}}'])
runs(sh(s, 'Autorizados cierre'), [None, '{{J_AUT_ANT}}'])
runs(sh(s, 'Fecha corte'), ['{{J_FECHA_CORTE}}'])
runs(sh(s, 'Pendientes corte'), [None, '{{J_PEND_HOY}}'])
runs(sh(s, 'Autorizados corte'), [None, '{{J_AUT_HOY}}'])
for k, pre in (('Programa', 'PROG'), ('Otros', 'OTROS')):
    runs(sh(s, f'{k} total'), [None, '{{J_%s_TOTAL}}' % pre])
    runs(sh(s, f'{k} autorizados'), ['({{J_%s_AUT}})' % pre])
    runs(sh(s, f'{k} detalle'), ['Backlog: {{J_%s_BK}}' % pre, 'Nuevas solicitudes: {{J_%s_MES}}' % pre])
runs(sh(s, 'Caracterizaciones texto'), [None, '{{J_CAR_TOTAL}}', None, '{{J_CAR_PEND}} pendientes.'])
runs(sh(s, 'Proyeccion'), [None, '{{J_PROY}}'])
runs(sh(s, 'Autorizado'), [None, '{{J_AUTORIZADO}}', '  ({{J_PCT}}%)'])

# Láminas 3 y 4: Ruta 1 y Ruta 2, P1 arriba y P2 abajo (los cuadros se repiten por panel, en ese orden).
for s, R in ((S[2], 'R1'), (S[3], 'R2')):
    runs(sh(s, 'Subtitulo'), ['cierre: {{FECHA_LARGA}}' if R == 'R1' else 'RMD pendientes por etapa y responsable · {{FECHA_LARGA}}'])
    if R == 'R1': runs(sh(s, 'Periodo status'), [None, '{{FECHA_PROGRAMA}}'])
    runs(sh(s, 'Autorizados'), [None, '{{J_%s_AUT}}' % R])
    for i, pl in enumerate(('P1', 'P2')):
        k = f'{R}_{pl}_'
        if R == 'R1': runs(sh(s, f'Titulo {pl}'), [None, 'Programados: {{%sTOTAL}}{{%sSINEST}}' % (k, k)])
        else: runs(sh(s, f'Titulo {pl}'), ['%s · Planta %s  (TOTAL {{%sTOTAL}}){{%sSINEST}}' % (pl, 'Ate' if pl == 'P1' else 'Lima', k, k)])
        runs(sh(s, f'Avance {pl}'), ['{{%sAVANCE}}' % k, None])
        for nombre, c in (('Borrador', 'BOR'), ('Ingresar', 'ING'), ('Flujo SAP', 'FLU'), ('Control de cambio', 'CC'), ('Por revision', 'REV'), ('Autorizado', 'AUT')):
            runs(sh(s, f'Valor {nombre}', i), ['{{%s%s}}' % (k, c)])
        runs(sh(s, 'Responsable Control de cambio', i), ['PRO {{%sCC_PRO}}' % k, ' · ASC {{%sCC_ASC}}' % k])
        if R == 'R1': runs(sh(s, 'Responsable Autorizado', i), ['{{%sAUT_BK}} del backlog · {{%sAUT_MES}} del mes' % (k, k)])

# Lámina 5: pendientes por planta (Ruta 1 arriba, Ruta 2 abajo); color de cada número para poder poner «–» en gris si es 0.
for t, R in zip([x.table for x in todas(S[4], 'Cuadro responsables por planta')], ('R1', 'R2')):
    for i, fila in enumerate(('P1', 'P2', 'T'), 1):
        for j, col in enumerate(('PRO', 'DOC', 'ASC', 'TOT'), 1):
            k = f'J_{R}_{fila}_{col}'
            celda(t.cell(i, j), '{{%s}}' % k, '{{%s_C}}' % k)

buf = io.BytesIO(); p.save(buf)

# Sin los complementos de Office (paneles de tareas ocultos) que traía el archivo de referencia.
zin = zipfile.ZipFile(buf)
out = io.BytesIO()
zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    if it.filename.startswith('ppt/webextensions/'): continue
    d = zin.read(it.filename)
    if it.filename == '_rels/.rels':
        d = re.sub(rb'<Relationship [^>]*webextensions/[^>]*/>', b'', d)
    if it.filename == '[Content_Types].xml':
        d = re.sub(rb'<Override PartName="/ppt/webextensions/[^>]*/>', b'', d)
    zout.writestr(it, d)
zout.close()
open(SALIDA, 'wb').write(out.getvalue())

if INDEX:
    b64 = base64.b64encode(out.getvalue()).decode()
    html = open(INDEX, encoding='utf8').read()
    linea = f"        const STATUS_RMD_JEFATURA_B64 = '{b64}';"
    if 'const STATUS_RMD_JEFATURA_B64 = ' in html:
        html = re.sub(r"^ *const STATUS_RMD_JEFATURA_B64 = '[^']*';", lambda m: linea, html, count=1, flags=re.M)
    else:
        m = re.search(r"^ *const STATUS_RMD_PLANTILLA_B64 = '[^']*';\n", html, flags=re.M)
        html = html[:m.end()] + linea + '\n' + html[m.end():]
    open(INDEX, 'w', encoding='utf8').write(html)
print('ok', len(out.getvalue()))
