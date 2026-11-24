"""Arma la plantilla del «PPT para jefatura» (marcadores {{...}}) desde el PPTX que Carlos presentó a jefatura y le aprobaron
(STATUS_RMD_2026-11-17_FINAL.pptx, 23/11/2026): 1 portada · 2 status general · 3 Ruta 1 P1+P2 · 4 Ruta 2 P1+P2 ·
5 pendientes por planta · 6 cierre. Todo queda igual al original; solo los números pasan a marcadores que llena la página.

Uso: python construir_plantilla_jefatura.py REFERENCIA.pptx SALIDA.pptx [index.html] [--lamina2 LAMINA2.pptx]
Con index.html, reemplaza (o agrega) la constante STATUS_RMD_JEFATURA_B64 en la página.
Con --lamina2, la lámina 2 se toma de ese PPTX (la estructura que Carlos armó el 24/11/2026 sobre el exportado:
STATUS_RMD_2026-11-24 (7).pptx): 31/10 → Solicitados del mes → corte (pendientes) y autorizados al cierre + AUTORIZADOS −
CAMBIO ESTADO → al corte. La lámina 5 también sale de ese PPTX («Pendientes por planta vs semana anterior», 24/11/2026).
"""
import base64, io, re, sys, zipfile
from pptx import Presentation

_args = list(sys.argv[1:])
L2REF = None
if '--lamina2' in _args:
    _i = _args.index('--lamina2'); L2REF = _args[_i + 1]; del _args[_i:_i + 2]
REF, SALIDA = _args[0], _args[1]
INDEX = _args[2] if len(_args) > 2 else None
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
    runs(sh(s, f'{k} total'), [None, '{{J_%s_NUM}}' % pre])
    runs(sh(s, f'{k} autorizados'), ['({{J_%s_AUT}})' % pre])
    runs(sh(s, f'{k} detalle'), ['Backlog: {{J_%s_BK}}' % pre, 'Nuevas solicitudes: {{J_%s_MES}}' % pre])
runs(sh(s, 'Caracterizaciones texto'), [None, '{{J_CAR_TOTAL}}', None, '{{J_CAR_PEND}} pendientes.'])
runs(sh(s, 'Autorizado'), [None, '{{J_AUTORIZADO}}', '  ({{J_PCT}}%)'])
# Pendientes al corte: cuántos son del backlog y cuántos nuevas solicitudes del mes (Carlos, 23/11/2026).
from pptx.util import Pt
from pptx.dml.color import RGBColor
_tf = sh(s, 'Pendientes corte').text_frame
for _t in ('Backlog: {{J_PEND_BK}}', 'Nuevas solicitudes: {{J_PEND_NUEVOS}}'):
    _rr = _tf.add_paragraph().add_run(); _rr.text = _t; _rr.font.size = Pt(10); _rr.font.name = 'Raleway'; _rr.font.color.rgb = RGBColor(0x4D, 0x4D, 0x4D)
# Forma final de la lámina 2 (Carlos, 24/11/2026, «dale esta forma al final»): sin el recuadro PROYECCIÓN ni las líneas de
# fórmula; la proyección va debajo de Programa y Otros («(Proyección: N)»), el paréntesis de autorizados y Backlog / Nuevas
# solicitudes quedan fuera de la tarjeta, y abajo: RMD AUTORIZADOS al cierre  +  AUTORIZADO (con «N cambiaron de status»)  →  al corte.
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Emu
from pptx.enum.text import PP_ALIGN
_px = sh(s, 'Proyeccion'); _px._element.getparent().remove(_px._element)
for k, pre in (('Programa', 'PROG'), ('Otros', 'OTROS')):
    _card = sh(s, k); _card.width = Emu(2150000)
    _tot = sh(s, f'{k} total'); _tot.width = Emu(1950000); _tot.top = _card.top + Emu(40000); _tot.height = Emu(610000)
    _p0 = _tot.text_frame.paragraphs[0]
    _rr = _tot.text_frame.add_paragraph().add_run(); _rr.text = '(Proyección: {{J_%s_PROY}})' % pre
    _rr.font.size = Pt(10); _rr.font.bold = True; _rr.font.name = 'Raleway'; _rr.font.color.rgb = RGBColor(0x4D, 0x4D, 0x4D)
    sh(s, f'{k} autorizados').left = _card.left + _card.width + Emu(150000)
    _det = sh(s, f'{k} detalle'); _det.left = _card.left + _card.width + Emu(800000); _det.width = Emu(1500000)
_au = sh(s, 'Autorizado')
_au.left, _au.top, _au.width, _au.height = Emu(4346000), Emu(3640000), Emu(3500000), Emu(1150000)
for _pp in _au.text_frame.paragraphs: _pp.alignment = PP_ALIGN.CENTER
_np = _au.text_frame.add_paragraph(); _np.alignment = PP_ALIGN.CENTER
_rr = _np.add_run(); _rr.text = '{{J_AUT_NS_TOT}} cambiaron de status'
_rr.font.size = Pt(12); _rr.font.name = 'Raleway'; _rr.font.color.rgb = RGBColor(0x4D, 0x4D, 0x4D)
_cy = sh(s, 'Autorizados cierre').top + sh(s, 'Autorizados cierre').height // 2
for _nom, _forma, _x, _w, _h in (('Mas', MSO_SHAPE.MATH_PLUS, 3366000, 720000, 720000), ('Flecha', MSO_SHAPE.RIGHT_ARROW, 8100000, 760000, 480000)):
    _f = s.shapes.add_shape(_forma, Emu(_x), Emu(_cy - _h // 2), Emu(_w), Emu(_h)); _f.name = _nom
    _f.fill.solid(); _f.fill.fore_color.rgb = RGBColor(0x1E, 0x5F, 0x74); _f.line.color.rgb = RGBColor(0x14, 0x3F, 0x4D)
# Cómo cuadra el cierre con el corte (Carlos, 23/11/2026: «breve y sencillo», sin cambiar el resto de la lámina).
from pptx.util import Pt, Emu
from pptx.dml.color import RGBColor
# Una línea por cuadro, con los números en negrita del color de su tarjeta. Cada línea se arma por partes con cada clic
# (Carlos, 23/11/2026: «que vean de dónde salió cada dato»): una copia de la línea por paso, una encima de otra, que solo
# deja ver su trozo (el resto transparente); al aparecer se resalta (crece y vuelve) la tarjeta de donde sale el dato.
from pptx.oxml.ns import qn
from lxml import etree
NAR, AZ, GR, BL = RGBColor(0xE0, 0x88, 0x3A), RGBColor(0x4A, 0x3F, 0x8C), RGBColor(0x4D, 0x4D, 0x4D), RGBColor(0xFF, 0xFF, 0xFF)
CUADRES = []   # Carlos, 24/11/2026: sin las líneas de fórmula al pie (la suma se ve en los recuadros de abajo).
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
# 1 cierre del mes anterior · 2 Programa y Otros · 3 caracterizaciones · 4 «+ AUTORIZADO →» · 5 corte.
# El título queda siempre a la vista.
_ids = {}
for _x in s.shapes: _ids.setdefault(_x.name, []).append(_x.shape_id)
_pasos = [['Fecha cierre', 'Pendientes cierre', 'Autorizados cierre'],
          ['Conector'] + [f'{k}{x}' for k in ('Programa', 'Otros') for x in ('', ' total', ' autorizados', ' detalle')],
          ['Caracterizaciones', 'Caracterizaciones franja', 'Caracterizaciones texto'],
          ['Mas', 'Autorizado', 'Flecha'], ['Fecha corte', 'Pendientes corte', 'Autorizados corte']]
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

# Lámina 2 nueva (Carlos, 24/11/2026: «adaptar el PPT… donde solicitados noviembre sale de estos 121 y 53»): se toma su lámina.
LAMINA2_XML = LAMINA5_XML = None
if L2REF:
    from lxml import etree as _et
    s7 = list(Presentation(L2REF).slides)[1]
    runs(sh(s7, 'Subtitulo'), ['corte {{FECHA_CORTA}}'])
    runs(sh(s7, 'Fecha cierre'), ['{{J_FECHA_ANT}}'])
    runs(sh(s7, 'Fecha corte'), ['{{J_FECHA_CORTE}}'])
    runs(sh(s7, 'Pendientes cierre'), [None, '{{J_PEND_ANT}}'])
    runs(sh(s7, 'Autorizados cierre'), [None, '{{J_AUT_ANT}}'])
    runs(sh(s7, 'Pendientes corte'), [None, '{{J_PEND_HOY}}'])
    runs(sh(s7, 'Autorizados corte'), [None, '{{J_AUT_HOY}}'])
    runs(sh(s7, 'Noviembre total'), ['Solicitados {{J_MES_NOMBRE}}', '{{J_SOL_MES}}'])
    runs(sh(s7, 'Noviembre', 0), [None, '{{J_AUTORIZADO}}', '{{J_AUT_BK}}', ' del backlog · ', '{{J_AUT_MESN}}', ' del mes'])
    sh(s7, 'Noviembre', 1).name = 'Cambio estado'
    runs(sh(s7, 'Cambio estado'), [None, '{{J_AUT_NS_TOT}}'])
    runs(sh(s7, 'Caracterizaciones texto'), [None, '{{J_CAR_TOTAL}}', '{{J_CAR_PEND}} pendientes.'])
    # Animación: 1 cierre · 2 solicitados del mes · 3 caracterizaciones · 4 + AUTORIZADOS · 5 − CAMBIO ESTADO · 6 → corte.
    _id7 = {}
    for _x in s7.shapes: _id7.setdefault(_x.name, []).append(_x)
    _con = sorted(_id7['Conector'], key=lambda x: x.shape_id)
    _horiz = [x.shape_id for x in _con if x.height == 0]
    _vert = [x for x in _con if x.width == 0]
    _car = min(_vert, key=lambda x: x.top).shape_id      # el punteado corto que baja de caracterizaciones
    _baja = max(_vert, key=lambda x: x.top).shape_id     # el que baja a AUTORIZADOS
    _ids1 = lambda *ns: [x.shape_id for n in ns for x in _id7[n]]
    _p7 = [_ids1('Fecha cierre', 'Pendientes cierre', 'Autorizados cierre'),
           _horiz + _ids1('Noviembre total'),
           _ids1('Caracterizaciones', 'Caracterizaciones franja', 'Caracterizaciones texto') + [_car],
           _ids1('Mas') + [_baja] + _ids1('Noviembre'),
           _ids1('Menos', 'Cambio estado'),
           _ids1('Flecha', 'Fecha corte', 'Pendientes corte', 'Autorizados corte')]
    _cxn = {x.shape_id for x in s7.shapes if x.shape_type == 9 or x._element.tag.endswith('cxnSp')}
    _n[0] = 2
    _c7 = ''.join(_clic(''.join(_efecto(x, k == 0) for k, x in enumerate(_l))) for _l in _p7)
    _b7 = ''.join(f'<p:bldP spid="{x}" grpId="0" animBg="1"/>' for _l in _p7 for x in _l if x not in _cxn)
    _t7 = ('<p:transition spd="med"><p:fade/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + _c7 + '</p:childTnLst></p:cTn>'
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        '</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>' + _b7 + '</p:bldLst></p:timing>')
    _el = s7._element
    for _tag in ('timing', 'transition'):
        for _e in _el.findall(qn('p:' + _tag)): _el.remove(_e)
    for _e in list(_el):
        if _e.tag.startswith('{http://schemas.openxmlformats.org/markup-compatibility'): _el.remove(_e)
    LAMINA2_XML = _et.tostring(_el, xml_declaration=True, encoding='UTF-8', standalone=True).decode('utf8')
    assert '</p:clrMapOvr>' in LAMINA2_XML
    LAMINA2_XML = LAMINA2_XML.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + _t7, 1)
    # Lámina 5 (Carlos, 24/11/2026: «hagamos esta comparativa en la lámina 5 tal cual»): por planta, PRO / DOC / ASC / Total
    # de la semana anterior (foto guardada de hace 7 días) vs hoy, con la variación y el %.
    s5 = list(Presentation(L2REF).slides)[4]
    for _pl in ('P1', 'P2'):
        _t = sh(s5, 'Comparativo %s · Planta %s' % (_pl, 'Ate' if _pl == 'P1' else 'Lima')).table
        celda(_t.cell(0, 1), '{{J_SEM_ANT}}'); celda(_t.cell(0, 2), '{{J_SEM_HOY}}')
        for _i, _k in enumerate(('PRO', 'DOC', 'ASC', 'TOT'), 1):
            for _j, _c in enumerate(('A', 'H', 'V', 'P'), 1):
                celda(_t.cell(_i, _j), '{{J_C_%s_%s_%s}}' % (_pl, _k, _c))
    _el5 = s5._element
    for _tag in ('timing', 'transition'):
        for _e in _el5.findall(qn('p:' + _tag)): _el5.remove(_e)
    LAMINA5_XML = _et.tostring(_el5, xml_declaration=True, encoding='UTF-8', standalone=True).decode('utf8')

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
    if it.filename == 'ppt/slides/slide5.xml' and LAMINA5_XML:
        d = LAMINA5_XML.encode('utf8')
    elif it.filename == 'ppt/slides/slide2.xml' and LAMINA2_XML:
        d = LAMINA2_XML.encode('utf8')
    elif it.filename == 'ppt/slides/slide2.xml':
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
