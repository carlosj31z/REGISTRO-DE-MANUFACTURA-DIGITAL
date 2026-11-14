"""Arma la plantilla del PowerPoint del status (marcadores {{...}}) desde el PPTX de referencia de Carlos (13/11/2026)."""
import re, sys, zipfile, io, copy
from pptx import Presentation
from lxml import etree

REF, SALIDA = sys.argv[1], sys.argv[2]
p = Presentation(REF)
S = list(p.slides)
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'

def sh(slide, nombre):
    for x in slide.shapes:
        if x.name == nombre: return x
    raise KeyError(nombre)

def runs(shape, *parrafos):
    """parrafos: lista de listas de textos, uno por run (sobran runs → se borran)."""
    tf = shape.text_frame
    for para, textos in zip(tf.paragraphs, parrafos):
        if textos is None: continue
        rs = para.runs
        assert len(rs) >= len(textos), (shape.name, [r.text for r in rs], textos)
        for r, t in zip(rs, textos): r.text = t
        for r in rs[len(textos):]: r._r.getparent().remove(r._r)

def celda(cell, t):
    para = cell.text_frame.paragraphs[0]
    rs = para.runs
    rs[0].text = t
    for r in rs[1:]: r._r.getparent().remove(r._r)

# Lámina 1
runs(sh(S[0], 'CuadroTexto 6'), None, ['{{FECHA_ISO}}'])

# Lámina 2: status general
s = S[1]
runs(sh(s, 'Subtitulo'), ['corte {{FECHA_CORTA}}'])
runs(sh(s, 'KPI valor 1'), ['{{G_AUT_T}}'])
runs(sh(s, 'KPI detalle 1'), ['P1 Ate {{G_AUT_P1}} · P2 Lima {{G_AUT_P2}}'])
runs(sh(s, 'KPI valor 2'), ['{{G_BK_T}}', ''])
runs(sh(s, 'KPI detalle 2'), ['P1 Ate ', '{{G_BK_P1}}', ' · P2 Lima ', '{{G_BK_P2}}'])
runs(sh(s, 'KPI etiqueta 3'), ['AUTORIZADOS EN {{MES_CORTO}} ({{RANGO_AUT}})'])
runs(sh(s, 'KPI valor 3'), ['{{G_AUTMES_T}}'])
runs(sh(s, 'KPI detalle 3'), ['{{G_AUTMES_BK}} del backlog · {{G_AUTMES_MES}} del ', 'mes'])
runs(sh(s, 'Panel backlog titulo'), ['Pendientes: backlog vs. {{MES_MIN}} ({{G_PEND_T}})'])
t = sh(s, 'Tabla status').table
for i, k in enumerate(['AUT', 'ING', 'SUS', 'INA', 'TOT'], 1):
    for j, c in enumerate(['P1', 'P2', 'T'], 1): celda(t.cell(i, j), '{{G_%s_%s}}' % (k, c))
for nombre, pre in (('Tabla backlog meses anteriores', 'BKA'), ('Tabla backlog noviembre', 'BKM')):
    t = sh(s, nombre).table
    if pre == 'BKM': celda(t.cell(0, 0), '{{MES_NOMBRE_SOLO}} (mes vigente)'); celda(t.cell(4, 0), 'Total {{MES_MIN}}')
    for i, k in enumerate(['ING', 'SOL', 'SUS', 'TOT'], 1):
        for j, c in enumerate(['P1', 'P2', 'T'], 1): celda(t.cell(i, j), '{{G_%s_%s_%s}}' % (pre, k, c))

# Láminas 3 y 4: Ruta 1, una por planta (las tablas de borradores y controles de cambio las arma la página).
lbl500 = copy.deepcopy(sh(S[3], 'Label 500')._element)
for s, pl, planta in ((S[2], 'P1', 'Ate'), (S[3], 'P2', 'Lima')):
    k = 'R1_%s_' % pl
    runs(sh(s, 'Shape 10'), ['RUTA 1: Flujo de Programa – %s' % pl])
    runs(sh(s, 'Shape 11'), ['cierre: {{FECHA_LARGA}}'])
    runs(sh(s, 'Shape 13'), ['%s · Planta %s  ' % (pl, planta), 'Programados: {{%sTOTAL}}' % k, '{{%sSINEST}}' % k])
    runs(sh(s, 'Periodo status'), None, ['{{FECHA_PROGRAMA}}'])
    aut = sh(s, 'Autorizados %s' % pl)
    runs(aut, None, ['{{%sAUT}}' % k])
    for n, c in (('301', 'BOR'), ('304', 'ING'), ('307', 'FLU'), ('310', 'CC'), ('313', 'REV'), ('316', 'AUT')):
        runs(sh(s, 'Valor %s' % n), ['{{%s%s}}' % (k, c)])
    runs(sh(s, 'Responsable 311'), ['PRO {{%sCC_PRO}} ' % k, '· ASC {{%sCC_ASC}}' % k])
    runs(sh(s, 'Avance Programa del mes'), ['{{%sAVANCE}}' % k], None)
    # Etiquetas: la de borradores con 3 runs (título, responsables, lista en línea), como la lámina de LIMA.
    viejo = sh(s, 'Label 500')._element
    nuevo = copy.deepcopy(lbl500); viejo.addprevious(nuevo); viejo.getparent().remove(viejo)
    runs(sh(s, 'Label 500'), ['Borradores pendientes · ', '{{%sLBL_BOR}}' % k, '{{%sBOR_LINEA}}' % k])
    runs(sh(s, 'Label 502'), ['Controles de cambio pendientes · ', '{{%sLBL_CC}}' % k])
    for x in list(s.shapes):
        if x.has_table: x._element.getparent().remove(x._element)
# Corrige la posición del recuadro «Autorizados P1» (igual que el de P2).
a1, a2 = sh(S[2], 'Autorizados P1'), sh(S[3], 'Autorizados P2')
a1.left, a1.top = a2.left, a2.top

# Láminas 5 y 6: Ruta 2
for s, pl, planta, tit in ((S[4], 'P1', 'Ate', 'Shape 13'), (S[5], 'P2', 'Lima', 'Shape 38')):
    k = 'R2_%s_' % pl
    runs(sh(s, 'Shape 10'), ['RUTA 2: Flujo de Caracterizaciones – %s' % pl])
    runs(sh(s, 'Shape 11'), ['RMD pendientes por etapa y responsable · {{FECHA_LARGA}}', '', ''] if pl == 'P1' else ['RMD pendientes por etapa y responsable · {{FECHA_LARGA}}'] + [''] * (len(sh(s, 'Shape 11').text_frame.paragraphs[0].runs) - 1))
    runs(sh(s, tit), ['%s · Planta %s (TOTAL {{%sTOTAL}}){{%sSINEST}}' % (pl, planta, k, k)])
    for n, c in (('301', 'BOR'), ('304', 'ING'), ('307', 'FLU'), ('310', 'CC'), ('313', 'REV'), ('316', 'AUT')):
        runs(sh(s, 'Valor %s' % n), ['{{%s%s}}' % (k, c)])
    r311 = sh(s, 'Responsable 311')
    runs(r311, ['PRO {{%sCC_PRO}}' % k, ' · ASC {{%sCC_ASC}}' % k])
    runs(sh(s, 'Avance 323'), ['{{%sAVANCE}}' % k], None)
    tx = [x for x in s.shapes if x.has_text_frame and x.text_frame.text.startswith('Tendencia')][0]
    runs(tx, ['Tendencia de RMD autorizados por mes, {{ANIO}}'])

buf = io.BytesIO(); p.save(buf)

# Gráficos: datos literales que llena la página (<!--CAT--> y <!--VAL-->), marcadores y etiquetas para todos los puntos.
zin = zipfile.ZipFile(buf)
zout = zipfile.ZipFile(SALIDA, 'w', zipfile.ZIP_DEFLATED)
for it in zin.infolist():
    d = zin.read(it.filename)
    if re.match(r'ppt/charts/chart\d+\.xml$', it.filename):
        x = d.decode('utf8')
        x = re.sub(r'<c:dPt>.*?</c:dPt>', '', x, flags=re.S)
        x = x.replace('<c:marker><c:symbol val="none"/></c:marker>', '<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="5A4A9E"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>')
        etiq = ('<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"><a:solidFill><a:srgbClr val="5A4A9E"/></a:solidFill>'
                '<a:latin typeface="Raleway"/></a:defRPr></a:pPr><a:endParaRPr lang="es-PE"/></a:p></c:txPr><c:dLblPos val="t"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>'
                '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>')
        x = re.sub(r'<c:dLbls>.*?</c:dLbls>(?=<c:cat>)', etiq, x, count=1, flags=re.S)
        x = re.sub(r'<c:cat>.*?</c:cat>', '<c:cat><!--CAT--></c:cat>', x, flags=re.S)
        x = re.sub(r'<c:val>.*?</c:val>', '<c:val><!--VAL--></c:val>', x, flags=re.S)
        x = re.sub(r'<c:max val="\d+"/>', '<!--MAX-->', x)
        x = re.sub(r'<c:majorUnit val="\d+"/>', '', x)
        d = x.encode('utf8')
    zout.writestr(it, d)
zout.close()
print('ok')
