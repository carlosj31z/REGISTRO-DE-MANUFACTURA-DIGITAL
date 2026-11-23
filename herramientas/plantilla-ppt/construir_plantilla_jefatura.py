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
# Una línea por cuadro, con los números en negrita del color de su tarjeta. Cada línea se arma por partes con cada clic
# (Carlos, 23/11/2026: «que vean de dónde salió cada dato»): una copia de la línea por paso, una encima de otra, que solo
# deja ver su trozo (el resto transparente); al aparecer se resalta (crece y vuelve) la tarjeta de donde sale el dato.
from pptx.oxml.ns import qn
from lxml import etree
NAR, AZ, GR, BL = RGBColor(0xE0, 0x88, 0x3A), RGBColor(0x4A, 0x3F, 0x8C), RGBColor(0x4D, 0x4D, 0x4D), RGBColor(0xFF, 0xFF, 0xFF)
CUADRES = [
    ('Cuadre pendientes', [
        ([('Pendientes: ', AZ, True), ('{{J_PEND_ANT}}', NAR, True), (' al {{J_FECHA_ANT}}', GR, False)], ['Pendientes cierre']),
        ([('  −  ', GR, False), ('{{J_AUT_BK}}', NAR, True), (' autorizados del backlog', GR, False)], ['Programa detalle', 'Otros detalle']),
        ([('  +  ', GR, False), ('{{J_PEND_NUEVOS}}', NAR, True), (' nuevas solicitudes', GR, False)], ['Pendientes corte']),
        ([('  =  ', GR, False), ('{{J_PEND_HOY}}', NAR, True), (' al {{J_FECHA_CORTE}}', GR, False)], ['Pendientes corte'])])]
# Sin línea de autorizados (Carlos, 23/11/2026, con su lámina): autorizados al cierre = al corte − AUTORIZADO del mes.
CUADRE_PASOS = []   # [(nombre de la copia, [tarjetas a resaltar])] en orden de clic
for _k, (_nombre, _trozos) in enumerate(CUADRES):
    for _m in range(len(_trozos)):
        _c = s.shapes.add_textbox(Emu(546100), Emu(5180000 + _k * 260000), Emu(11420000), Emu(250000)); _c.name = f'{_nombre} {_m + 1}'
        _tf = _c.text_frame; _tf.word_wrap = True
        _tf.margin_left = _tf.margin_right = _tf.margin_top = _tf.margin_bottom = 0
        _pp = _tf.paragraphs[0]
        for _q, (_partes, _) in enumerate(_trozos):
            for _t, _col, _b in _partes:
                _rr = _pp.add_run(); _rr.text = _t; _rr.font.size = Pt(11); _rr.font.bold = _b; _rr.font.name = 'Raleway'
                _rr.font.color.rgb = _col
                if _q != _m:   # solo se ve su trozo; el resto ocupa su lugar pero transparente
                    _clr = _rr.font.color._xFill.find(qn('a:srgbClr')) if hasattr(_rr.font.color, '_xFill') else None
                    _clr = _rr._r.find(qn('a:rPr')).find('.//' + qn('a:srgbClr'))
                    etree.SubElement(_clr, qn('a:alpha')).set('val', '0')
        CUADRE_PASOS.append((_c.name, _trozos[_m][1], None))

# Animaciones de la lámina 2 (Carlos, 23/11/2026: «que se entienda la suma»): con cada clic aparece (desvanecer) un paso:
# 1 cierre del mes anterior · 2 Programa y Otros · 3 caracterizaciones · 4 proyección y autorizado · 5 corte ·
# 6 cuadre de pendientes. El título queda siempre a la vista.
_ids = {}
for _x in s.shapes: _ids.setdefault(_x.name, []).append(_x.shape_id)
_pasos = [['Fecha cierre', 'Pendientes cierre', 'Autorizados cierre'],
          ['Conector'] + [f'{k}{x}' for k in ('Programa', 'Otros') for x in ('', ' total', ' autorizados', ' detalle')],
          ['Caracterizaciones', 'Caracterizaciones franja', 'Caracterizaciones texto'],
          ['Proyeccion', 'Autorizado'], ['Fecha corte', 'Pendientes corte', 'Autorizados corte']]
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
def _resaltar(spid):
    # Énfasis «Aumentar o reducir» al 108 % que vuelve a su tamaño.
    return (f'<p:par><p:cTn id="{_cid()}" presetID="6" presetClass="emph" presetSubtype="0" autoRev="1" fill="hold" nodeType="withEffect">'
            '<p:stCondLst><p:cond delay="200"/></p:stCondLst><p:childTnLst>'
            f'<p:animScale><p:cBhvr><p:cTn id="{_cid()}" dur="450" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr>'
            '<p:by x="108000" y="108000"/></p:animScale></p:childTnLst></p:cTn></p:par>')
def _ocultar(spid):
    return (f'<p:par><p:cTn id="{_cid()}" presetID="1" presetClass="exit" presetSubtype="0" fill="hold" grpId="1" nodeType="withEffect">'
            '<p:stCondLst><p:cond delay="500"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{_cid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
            '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="hidden"/></p:to></p:set>'
            '</p:childTnLst></p:cTn></p:par>')
def _opacidad(spid, val, delay=0):
    # Énfasis «Transparencia»: atenúa (0.3) o devuelve (1) la tarjeta y se queda así.
    return (f'<p:par><p:cTn id="{_cid()}" presetID="9" presetClass="emph" presetSubtype="0" fill="hold" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{_cid()}" dur="400" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
            f'<p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="{val}"/></p:to></p:set>'
            f'<p:animEffect filter="image" prLst="opacity: {val}"><p:cBhvr rctx="IE"><p:cTn id="{_cid()}" dur="400" fill="hold"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>')
def _color(spid):
    # Énfasis «Color de fuente»: el texto de la tarjeta (su número) se ilumina en dorado y vuelve.
    return (f'<p:par><p:cTn id="{_cid()}" presetID="3" presetClass="emph" presetSubtype="2" autoRev="1" fill="hold" nodeType="withEffect">'
            '<p:stCondLst><p:cond delay="200"/></p:stCondLst><p:childTnLst>'
            f'<p:animClr clrSpc="rgb"><p:cBhvr override="childStyle"><p:cTn id="{_cid()}" dur="700" fill="hold"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
            '<p:attrNameLst><p:attrName>style.color</p:attrName></p:attrNameLst></p:cBhvr><p:to><a:srgbClr val="F2B705"/></p:to></p:animClr>'
            '</p:childTnLst></p:cTn></p:par>')
_ids = {}
for _x in s.shapes: _ids.setdefault(_x.name, []).append(_x.shape_id)
_ocultos = set()
_cuerpo = ''
def _clic(efs):
    a1, a2 = _cid(), _cid()
    return (f'<p:par><p:cTn id="{a1}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{a2}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{efs}</p:childTnLst></p:cTn></p:par>'
            '</p:childTnLst></p:cTn></p:par>')
for _l in _pasos_ids:
    _cuerpo += _clic(''.join(_efecto(x, k == 0) for k, x in enumerate(_l)))
_cuadre_ids = []
# Mientras se muestra un dato, las demás tarjetas se atenúan (Carlos, 23/11/2026); al terminar el cuadre vuelven todas.
_tarjetas_todas = [x for _l in _pasos_ids for x in _l]
for _q, (_copia, _tarjetas, _anterior) in enumerate(CUADRE_PASOS):
    _sp = _ids[_copia][0]; _cuadre_ids.append(_sp)
    _fuente = {x for t in _tarjetas for x in _ids[t][:1]}
    _efs = _efecto(_sp, True) + ''.join(_resaltar(x) + _color(x) for x in sorted(_fuente))
    _efs += ''.join(_opacidad(x, '1' if x in _fuente else '0.3') for x in _tarjetas_todas)
    if _q == len(CUADRE_PASOS) - 1:
        _efs += ''.join(_opacidad(x, '1', 2500) for x in _tarjetas_todas)
    if _anterior:
        _efs += _ocultar(_ids[_anterior][0]); _ocultos.add(_ids[_anterior][0])
    _cuerpo += _clic(_efs)
_bld = ''.join(f'<p:bldP spid="{x}" grpId="0" animBg="1"/>' for _l in _pasos_ids + [_cuadre_ids] for x in _l if x not in _cxn)
_bld += ''.join(f'<p:bldP spid="{x}" grpId="1" animBg="1"/>' for x in sorted(_ocultos))
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
