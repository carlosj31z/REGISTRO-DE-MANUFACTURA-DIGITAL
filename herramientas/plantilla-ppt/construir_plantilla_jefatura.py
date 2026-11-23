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
# Pendientes al corte: cuántos son del backlog y cuántos nuevas solicitudes del mes (Carlos, 23/11/2026).
from pptx.util import Pt
from pptx.dml.color import RGBColor
_tf = sh(s, 'Pendientes corte').text_frame
for _t in ('Backlog: {{J_PEND_BK}}', 'Nuevas solicitudes: {{J_PEND_NUEVOS}}'):
    _rr = _tf.add_paragraph().add_run(); _rr.text = _t; _rr.font.size = Pt(10); _rr.font.name = 'Raleway'; _rr.font.color.rgb = RGBColor(0x4D, 0x4D, 0x4D)
# Cómo cuadra el cierre con el corte (Carlos, 23/11/2026: «breve y sencillo», sin cambiar el resto de la lámina).
from pptx.util import Pt, Emu
from pptx.dml.color import RGBColor
# Una línea por cuadro (para animarlas por separado), con los números en negrita del color de su tarjeta.
NAR, AZ, GR = RGBColor(0xE0, 0x88, 0x3A), RGBColor(0x4A, 0x3F, 0x8C), RGBColor(0x4D, 0x4D, 0x4D)
for _k, (_nombre, _partes) in enumerate([
        ('Cuadre pendientes', [('Pendientes: ', AZ, True), ('{{J_PEND_ANT}}', NAR, True), (' al {{J_FECHA_ANT}}  −  ', GR, False), ('{{J_AUT_BK}}', NAR, True),
            (' autorizados del backlog  +  ', GR, False), ('{{J_PEND_NUEVOS}}', NAR, True), (' nuevas solicitudes  =  ', GR, False), ('{{J_PEND_HOY}}', NAR, True), (' al {{J_FECHA_CORTE}}', GR, False)]),
        ('Cuadre autorizados', [('Autorizados: ', AZ, True), ('{{J_AUT_ANT}}', AZ, True), (' al {{J_FECHA_ANT}}  +  ', GR, False), ('{{J_AUTORIZADO}}', AZ, True),
            (' autorizados del mes  −  ', GR, False), ('{{J_AUT_REAUT}}', AZ, True), (' ya contados al ', GR, False), ('{{J_FECHA_ANT}}', GR, False), (' (versión nueva o reautorizados)  −  ', GR, False), ('{{J_AUT_SUSP}}', AZ, True), (' suspendidos en el mes  =  ', GR, False), ('{{J_AUT_HOY}}', AZ, True), (' al {{J_FECHA_CORTE}}', GR, False)])]):
    _c = s.shapes.add_textbox(Emu(546100), Emu(5180000 + _k * 260000), Emu(11099800), Emu(250000)); _c.name = _nombre
    _tf = _c.text_frame; _tf.word_wrap = True
    _tf.margin_left = _tf.margin_right = _tf.margin_top = _tf.margin_bottom = 0
    _pp = _tf.paragraphs[0]
    for _t, _col, _b in _partes:
        _rr = _pp.add_run(); _rr.text = _t; _rr.font.size = Pt(11); _rr.font.bold = _b; _rr.font.name = 'Raleway'; _rr.font.color.rgb = _col

# Animaciones de la lámina 2 (Carlos, 23/11/2026: «que se entienda la suma»): con cada clic aparece (desvanecer) un paso:
# 1 cierre del mes anterior · 2 Programa y Otros · 3 caracterizaciones · 4 proyección y autorizado · 5 corte ·
# 6 cuadre de pendientes · 7 cuadre de autorizados. El título queda siempre a la vista.
_ids = {}
for _x in s.shapes: _ids.setdefault(_x.name, []).append(_x.shape_id)
_pasos = [['Fecha cierre', 'Pendientes cierre', 'Autorizados cierre'],
          ['Conector'] + [f'{k}{x}' for k in ('Programa', 'Otros') for x in ('', ' total', ' autorizados', ' detalle')],
          ['Caracterizaciones', 'Caracterizaciones franja', 'Caracterizaciones texto'],
          ['Proyeccion', 'Autorizado'], ['Fecha corte', 'Pendientes corte', 'Autorizados corte'], ['Cuadre pendientes'], ['Cuadre autorizados']]
_conector_car = max(_ids['Conector'])   # el conector punteado de caracterizaciones es el último
_pasos_ids = []
for _i, _p in enumerate(_pasos):
    _l = []
    for _n in _p: _l += [x for x in _ids[_n] if not (_n == 'Conector' and x == _conector_car)]
    if _i == 2: _l.append(_conector_car)
    _pasos_ids.append(_l)
_cxn = {x.shape_id for x in s.shapes if x.shape_type == 9 or x._element.tag.endswith('cxnSp')}
_n = [2]
def _cid():
    _n[0] += 1; return _n[0]
def _efecto(spid, primero):
    tipo = 'clickEffect' if primero else 'withEffect'
    return (f'<p:par><p:cTn id="{_cid()}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="{tipo}"{"" if spid in _cxn else " grpId=\"0\""}>'
            '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{_cid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
            '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{_cid()}" dur="500"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
            '</p:childTnLst></p:cTn></p:par>')
_cuerpo = ''
for _l in _pasos_ids:
    a1, a2 = _cid(), _cid()
    _efs = ''.join(_efecto(x, k == 0) for k, x in enumerate(_l))
    _cuerpo += (f'<p:par><p:cTn id="{a1}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>'
                f'<p:par><p:cTn id="{a2}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{_efs}</p:childTnLst></p:cTn></p:par>'
                '</p:childTnLst></p:cTn></p:par>')
_bld = ''.join(f'<p:bldP spid="{x}" grpId="0"{" animBg=\"1\"" if True else ""}/>' for _l in _pasos_ids for x in _l if x not in _cxn)
TIMING_LAMINA2 = ('<p:transition spd="med"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
    '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + _cuerpo + '</p:childTnLst></p:cTn>'
    '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
    '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
    '</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>' + _bld + '</p:bldLst></p:timing>')

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
        runs(sh(s, 'Responsable Control de cambio', i), ['PRO {{%sCC_PRO}}' % k, ' · ASC {{%sCC_ASC}}{{%sCC_SD}}' % (k, k)])
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
    if it.filename == 'ppt/slides/slide2.xml':
        x = d.decode('utf8')
        assert '<p:timing' not in x and '<p:transition' not in x
        d = x.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + TIMING_LAMINA2, 1).encode('utf8')
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
