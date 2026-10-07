// ============================================================================
// baseDxf.js — la BASE dei grigliati (profilo esterno e fori) letta da
// Base.dxf (7/10, decisione di Dario)
//
// Fino al 7/10 la base era scritta a mano nello SVG di Grating.vue (un <path>
// e 9 cerchi). Ora la disegna Dario in un file Base.dxf che sta FUORI dal
// repo, nella cartella Grating_model_dir del backend (route
// GET /api/conf/grating/base): se cambia il disegno si sostituisce il file,
// niente codice e niente build.
//
// IL FRAME DEL FILE (decisione di Dario del 7/10, verso verificato sul
// cassetto 8 la sera del 7/10). Il DXF e' il grigliato come lo inserisce
// l'operatore nel cassetto, VISTO DAL LATO OPERATORE: 0,0 in alto a sinistra
// del rettangolo del cassetto, X verso destra, Y NEGATIVA verso il basso; la
// scritta "Robot" sta sul lato lontano dall'operatore, in alto. Lo 0,0 e'
// l'origine del work object del robot, e la tasca 1 ci sta vicino. E' la
// stessa vista della pagina Cassetti (TrayPockets) e dell'anteprima di
// Grating.vue, quindi:
//   SVG di Grating.vue:   x_svg = x_dxf,  y_svg = -y_dxf   (nessuna rotazione)
//   tasca in coordinate robot (X, Y) micron (util/gratingAxes.js
//   drawingToRobot, X = h, Y = w di gridCenters; il disegno la mette in
//   (w, h)):            x_dxf = Y/1000,  y_dxf = -X/1000
// Il robot sta dal lato opposto: per lui la tasca 1 e' in basso a destra.
// Le quote sono in mm: $INSUNITS e $EXTMIN/$EXTMAX non si usano (nel file di
// Dario del 7/10 $INSUNITS dice pollici e gli EXT sono vecchi).
//
// Pura, senza dipendenze (in cella npm non ha rete). I messaggi sono chiavi
// i18n (grating.base.*) con parametri: il pannello li traduce.
// ============================================================================

// spessore minimo di materiale fra una cavita' e un foro o il profilo, mm.
// DA CONFERMARE con Dario.
export const BASE_WEB_MM = 3;
// scarto di corda massimo quando un arco (bulge) si spezza in segmenti, mm
export const BULGE_CHORD_TOL_MM = 0.05;
// codici d'errore della route GET /api/conf/grating/base (corpo JSON)
export const BASE_DXF_MISSING = 'BASE_DXF_MISSING';
export const BASE_DIR_UNSET = 'BASE_DIR_UNSET';
export const BASE_DXF_TOO_LARGE = 'BASE_DXF_TOO_LARGE';
export const BASE_DXF_READ = 'BASE_DXF_READ';
// la base RIEMPIE il cassetto: un profilo che non arriva a meta' cassetto su
// un asse e' disegnato in pollici o in cm (in pollici 820 x 610 mm diventa
// circa 32 x 24 e starebbe comodo nel controllo dei bordi)
export const BASE_MIN_FILL = 0.5;

const UNITA = { 0: 'senza unita', 1: 'pollici', 2: 'piedi', 4: 'mm', 5: 'cm', 6: 'm' };
const errore = (key, params = {}) => ({ error: { key: 'grating.base.err.' + key, params } });
const avviso = (key, params = {}) => ({ key: 'grating.base.warn.' + key, params });

// testo MTEXT senza formattazione: {\H9;\fArial|b0|i0;testo} -> testo
export function mtextPlain(s) {
	// \\ \{ \} sono caratteri veri: messi da parte prima di togliere i codici
	let t = String(s || '').replace(/\\\\/g, '').replace(/\\\{/g, '').replace(/\\\}/g, '');
	t = t.replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
	t = t.replace(/\\[Pp]/g, ' ');
	t = t.replace(/\\[ACcFfHhQqTtWwp][^;]*;/g, '');
	t = t.replace(/\\S([^;]*);/g, (m, x) => x.replace(/[#^]/, '/'));
	t = t.replace(/\\[LlOoKkNn~]/g, '');
	t = t.replace(/[{}]/g, '');
	t = t.replace(//g, '{').replace(//g, '}').replace(//g, '\\');
	return t.replace(/\s+/g, ' ').trim();
}

// i punti INTERNI dell'arco fra p0 e p1 con bulge b (b = tan(angolo/4),
// positivo = antiorario da p0 a p1, nel DXF con la Y verso l'alto), con
// scarto di corda <= tol. Formule standard del bulge: raggio
// r = c(1+b^2)/(4|b|), freccia s = b*c/2 sulla normale DESTRA della corda;
// il centro sta sulla stessa normale a s - sign(b)*r dal punto medio.
export function bulgePoints(p0, p1, b, tol = BULGE_CHORD_TOL_MM) {
	if (!b) return [];
	const dx = p1.x - p0.x, dy = p1.y - p0.y;
	const c = Math.hypot(dx, dy);
	if (c === 0) return [];
	const theta = 4 * Math.atan(b);                  // angolo dell'arco, positivo antiorario
	const r = c * (1 + b * b) / (4 * Math.abs(b));
	const nx = dy / c, ny = -dx / c;                 // normale destra della corda p0 -> p1
	const k = b * c / 2 - Math.sign(b) * r;
	const cx = (p0.x + p1.x) / 2 + nx * k, cy = (p0.y + p1.y) / 2 + ny * k;
	const a0 = Math.atan2(p0.y - cy, p0.x - cx);
	// numero di segmenti: scarto di corda r(1 - cos(phi/2)) <= tol
	const ratio = Math.max(-1, Math.min(1, 1 - tol / r));
	const maxPhi = ratio <= -1 ? Math.PI : 2 * Math.acos(ratio);
	const n = Math.max(1, Math.ceil(Math.abs(theta) / Math.max(maxPhi, 1e-9)));
	const out = [];
	for (let i = 1; i < n; i++) {
		const a = a0 + theta * i / n;
		out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
	}
	return out;
}

// il profilo chiuso come elenco di punti, archi spezzati (coordinate DXF)
export function profilePoints(profile, tol = BULGE_CHORD_TOL_MM) {
	const pts = [];
	const n = (profile || []).length;
	for (let i = 0; i < n; i++) {
		const p = profile[i], q = profile[(i + 1) % n];
		pts.push({ x: p.x, y: p.y });
		pts.push(...bulgePoints(p, q, p.bulge || 0, tol));
	}
	return pts;
}

function riquadro(pts) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const p of pts) {
		if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
		if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
	}
	return { minX, minY, maxX, maxY };
}

// punto dentro il poligono (ray casting); sul bordo conta come dentro o
// fuori a seconda dell'arrotondamento, per i controlli basta
export function insidePolygon(pt, poly) {
	let dentro = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i], b = poly[j];
		if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
	}
	return dentro;
}

// ---------------------------------------------------------------- lettura
// text = contenuto di Base.dxf; width/height = misure del cassetto in mm
// (controllo "sta nel cassetto"; senza, il controllo si salta).
export function parseBaseDxf(text, { width, height } = {}) {
	const s = String(text || '');
	if (/^AutoCAD Binary DXF/.test(s)) return errore('binary');
	const righe = s.split(/\r?\n/);
	const coppie = [];
	for (let i = 0; i + 1 < righe.length; i += 2) {
		const codice = parseInt(righe[i].trim(), 10);
		if (!Number.isInteger(codice)) return errore('notDxf', { riga: i + 1 });
		coppie.push([codice, righe[i + 1]]);
	}
	// sezioni: HEADER ($INSUNITS, $ACADVER) ed ENTITIES
	let sezione = null, insunits = null, acadver = '';
	const entita = [];
	let cur = null;
	for (let k = 0; k < coppie.length; k++) {
		const [c, v] = coppie[k];
		const val = v.trim();
		if (c === 0 && val === 'SECTION') { sezione = coppie[k + 1] ? coppie[k + 1][1].trim() : null; cur = null; k++; continue; }
		if (c === 0 && val === 'ENDSEC') { sezione = null; cur = null; continue; }
		if (sezione === 'HEADER' && c === 9) {
			const succ = coppie[k + 1];
			if (val === '$INSUNITS' && succ) insunits = parseInt(succ[1].trim(), 10);
			if (val === '$ACADVER' && succ) acadver = succ[1].trim();
			continue;
		}
		if (sezione !== 'ENTITIES') continue;
		if (c === 0) { cur = { tipo: val, codici: [] }; entita.push(cur); continue; }
		if (cur) cur.codici.push([c, v]);
	}
	const info = { acadver, insunits, unitaDichiarata: insunits == null ? 'non dichiarata' : (UNITA[insunits] || ('codice ' + insunits)),
		entita: entita.length, ignorate: {}, pieces: 0, profileVertices: 0, holes: 0, texts: 0, testiVuoti: 0 };
	const warnings = [];
	if (insunits != null && insunits !== 4 && insunits !== 0)
		warnings.push(avviso('units', { unita: info.unitaDichiarata, codice: insunits }));
	const conta = tipo => { info.ignorate[tipo] = (info.ignorate[tipo] || 0) + 1; };
	const leggi = (e, c, d) => { const x = e.codici.find(p => p[0] === c); return x ? x[1] : d; };
	const num = (e, c, d = 0) => { const x = leggi(e, c, null); const n = x == null ? d : parseFloat(String(x).trim()); return Number.isFinite(n) ? n : d; };
	const layer = e => String(leggi(e, 8, '0')).trim();
	// estrusione: (0,0,1) ok; (0,0,-1) = x col segno cambiato; altro: errore
	const verso = e => {
		const ex = num(e, 210, 0), ey = num(e, 220, 0), ez = num(e, 230, 1);
		if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9 && Math.abs(ez - 1) < 1e-9) return 1;
		if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9 && Math.abs(ez + 1) < 1e-9) return -1;
		return 0;
	};

	const profili = [], holes = [], texts = [];
	let sciolti = 0, inserts = 0, estrusioneRotta = null, profilo3d = false;
	const layerFori = new Map();      // layer diverso da HOLES -> quanti fori
	for (let k = 0; k < entita.length; k++) {
		const e = entita[k];
		const lay = layer(e), layU = lay.toUpperCase();
		if (e.tipo === 'VERTEX' || e.tipo === 'SEQEND') continue;     // letti con la POLYLINE
		const v = verso(e);
		if (v === 0 && ['LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'TEXT', 'MTEXT', 'LINE', 'ARC'].includes(e.tipo) && layU !== 'PIECES') { estrusioneRotta = e.tipo + ' sul layer ' + lay; continue; }
		if (layU === 'PIECES') {
			info.pieces++;
			if (e.tipo === 'POLYLINE') while (entita[k + 1] && (entita[k + 1].tipo === 'VERTEX' || entita[k + 1].tipo === 'SEQEND')) k++;
			continue;
		}
		if (e.tipo === 'LWPOLYLINE' && layU === 'PROFILE') {
			const vert = [];
			for (const [c, val] of e.codici) {
				if (c === 10) vert.push({ x: parseFloat(val) * v, y: 0, bulge: 0 });
				else if (c === 20 && vert.length) vert[vert.length - 1].y = parseFloat(val);
				else if (c === 42 && vert.length) vert[vert.length - 1].bulge = parseFloat(val) * v;
			}
			profili.push({ vert, chiusa: (Math.round(num(e, 70, 0)) & 1) === 1 });
			continue;
		}
		if (e.tipo === 'POLYLINE' && layU === 'PROFILE') {
			const flag = Math.round(num(e, 70, 0));
			if (flag & (8 | 16 | 64)) profilo3d = true;
			const vert = [];
			while (entita[k + 1] && entita[k + 1].tipo === 'VERTEX') {
				k++;
				const vx = entita[k];
				vert.push({ x: num(vx, 10) * v, y: num(vx, 20), bulge: num(vx, 42) * v });
			}
			if (entita[k + 1] && entita[k + 1].tipo === 'SEQEND') k++;
			profili.push({ vert, chiusa: (flag & 1) === 1 });
			continue;
		}
		if (e.tipo === 'POLYLINE') {      // polilinea R12 su un altro layer: si salta coi suoi vertici
			while (entita[k + 1] && (entita[k + 1].tipo === 'VERTEX' || entita[k + 1].tipo === 'SEQEND')) k++;
			conta('POLYLINE'); continue;
		}
		if ((e.tipo === 'LINE' || e.tipo === 'ARC') && layU === 'PROFILE') { sciolti++; continue; }
		if (e.tipo === 'CIRCLE') {
			holes.push({ cx: num(e, 10) * v, cy: num(e, 20), r: num(e, 40) });
			if (layU !== 'HOLES') layerFori.set(lay, (layerFori.get(lay) || 0) + 1);
			continue;
		}
		if (e.tipo === 'TEXT' || e.tipo === 'MTEXT') {
			const testo = e.tipo === 'MTEXT'
				? mtextPlain(e.codici.filter(p => p[0] === 3).map(p => p[1]).join('') + leggi(e, 1, ''))
				: String(leggi(e, 1, '')).trim();
			if (!testo) { info.testiVuoti++; continue; }
			let attach;
			let x = num(e, 10), y = num(e, 20);
			if (e.tipo === 'MTEXT') attach = Math.round(num(e, 71, 1));
			else {
				// TEXT: allineamento 72 (0 sinistra, 1 e 4 centro, 2 destra) e 73
				// (0 base, 1 sotto, 2 centro, 3 sopra), tradotto nel punto di
				// attacco MTEXT 1..9 (riga sopra/centro/sotto, colonna sx/centro/dx)
				const h72 = Math.round(num(e, 72, 0)), v73 = Math.round(num(e, 73, 0));
				if (h72 || v73) { x = num(e, 11, x); y = num(e, 21, y); }
				const col = (h72 === 1 || h72 === 4) ? 2 : h72 === 2 ? 3 : 1;
				const riga = v73 === 3 ? 0 : v73 === 2 ? 1 : 2;
				attach = riga * 3 + col;
			}
			texts.push({ x: x * v, y, h: num(e, 40, 2.5), text: testo, attach });
			continue;
		}
		if (e.tipo === 'INSERT') { inserts++; conta('INSERT'); continue; }
		conta(e.tipo + (layU === 'PROFILE' ? ' (PROFILE)' : ''));
	}
	info.holes = holes.length;
	info.texts = texts.length;
	if (estrusioneRotta) return Object.assign(errore('extrusion', { dove: estrusioneRotta }), { info });
	if (profilo3d) return Object.assign(errore('profile3d'), { info });
	if (sciolti > 0 && profili.length === 0) return Object.assign(errore('profileLoose', { n: sciolti }), { info });
	if (profili.length === 0) return Object.assign(errore('profileMissing'), { info });
	if (profili.length > 1) return Object.assign(errore('profileMany', { n: profili.length }), { info });
	if (sciolti > 0) return Object.assign(errore('profileLoose', { n: sciolti }), { info });
	const pr = profili[0];
	let vert = pr.vert.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
	if (vert.length < 3) return Object.assign(errore('profileMissing'), { info });
	if (!pr.chiusa) {
		const a = vert[0], b = vert[vert.length - 1];
		if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) return Object.assign(errore('profileOpen'), { info });
		// chiusa coi punti (ultimo = primo) ma senza il flag: si accetta
		vert = vert.slice(0, -1);
		warnings.push(avviso('closedByPoints'));
	}
	info.profileVertices = vert.length;
	const poly = profilePoints(vert);
	const box = riquadro(poly);
	info.bbox = box;
	// contro il cassetto W x H: il profilo sta in x [-1, W+1], y [-H-1, +1]
	// (origine in alto a sinistra) e ne copre almeno BASE_MIN_FILL (quote in mm)
	const W = Number(width), H = Number(height);
	if (W > 0 && H > 0) {
		const tol = 1;
		if (box.minX < -tol || box.maxX > W + tol || box.minY < -H - tol || box.maxY > tol
			|| box.maxX - box.minX < W * BASE_MIN_FILL || box.maxY - box.minY < H * BASE_MIN_FILL)
			return Object.assign(errore('outOfTray', { w: W, h: H, minX: r3(box.minX), maxX: r3(box.maxX), minY: r3(box.minY), maxY: r3(box.maxY) }), { info });
	}
	for (const [l, n] of layerFori) warnings.push(avviso('holeLayer', { layer: l, n }));
	const fuori = holes.filter(h => !insidePolygon({ x: h.cx, y: h.cy }, poly));
	if (fuori.length) warnings.push(avviso('holeOutside', { n: fuori.length, dove: fuori.map(h => '(' + r3(h.cx) + ', ' + r3(h.cy) + ')').join(', ') }));
	if (info.pieces) warnings.push(avviso('pieces', { n: info.pieces }));
	if (inserts) warnings.push(avviso('insert', { n: inserts }));
	return { profile: vert, holes, texts, info, warnings };
}
const r3 = v => Math.round(v * 1000) / 1000;

// la risposta d'errore della route GET /api/conf/grating/base (status HTTP e
// corpo JSON) -> { key, params } per la riga rossa di Grating.vue
export function baseRouteError(status, body) {
	const b = body || {};
	const path = b.path ? String(b.path) : '';
	if (b.error === BASE_DIR_UNSET) return { key: 'grating.base.err.dirUnset', params: { path } };
	if (b.error === BASE_DXF_MISSING) return { key: 'grating.base.err.missing', params: { path } };
	if (b.error === BASE_DXF_TOO_LARGE) return { key: 'grating.base.err.tooLarge', params: { path, size: b.size } };
	if (b.error === BASE_DXF_READ) return { key: 'grating.base.err.read', params: { path } };
	return { key: 'grating.base.err.http', params: { path, status } };
}

// ---------------------------------------------------------------- disegno
// la base nelle coordinate SVG di Grating.vue: x_svg = x_dxf, y_svg = -y_dxf.
// d = path del profilo (archi spezzati), holes e texts, bbox in SVG.
export function baseToSvg(base) {
	if (!base || !base.profile) return null;
	const pts = profilePoints(base.profile).map(p => ({ x: p.x, y: -p.y }));
	const f = v => String(Math.round(v * 1e4) / 1e4);
	const d = 'M' + pts.map(p => f(p.x) + ' ' + f(p.y)).join(' L') + ' Z';
	const holes = (base.holes || []).map(h => ({ cx: h.cx, cy: -h.cy, r: h.r }));
	// MTEXT attach 1..9: colonna (1 sinistra, 2 centro, 3 destra), riga (1 sopra, 2 centro, 3 sotto)
	const texts = (base.texts || []).map(t => {
		const col = ((t.attach || 1) - 1) % 3, riga = Math.floor(((t.attach || 1) - 1) / 3);
		return { x: t.x, y: -t.y, size: t.h, text: t.text,
			anchor: ['start', 'middle', 'end'][col], baseline: ['hanging', 'central', 'alphabetic'][riga] };
	});
	const box = riquadro(pts);
	for (const h of holes) {
		box.minX = Math.min(box.minX, h.cx - h.r); box.maxX = Math.max(box.maxX, h.cx + h.r);
		box.minY = Math.min(box.minY, h.cy - h.r); box.maxY = Math.max(box.maxY, h.cy + h.r);
	}
	return { d, holes, texts, bbox: box };
}

// ---------------------------------------------------------------- tasche / base
function distPuntoSegmento(p, a, b) {
	const dx = b.x - a.x, dy = b.y - a.y;
	const l2 = dx * dx + dy * dy;
	let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function segmentiSiTagliano(a, b, c, d) {
	const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
	return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function distSegmenti(a, b, c, d) {
	if (segmentiSiTagliano(a, b, c, d)) return 0;
	return Math.min(distPuntoSegmento(a, c, d), distPuntoSegmento(b, c, d), distPuntoSegmento(c, a, b), distPuntoSegmento(d, a, b));
}
// distanza da un punto al rettangolo (0 se dentro)
function distPuntoRett(p, r) {
	const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
	const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
	return Math.hypot(dx, dy);
}

// Le tasche contro la base, in coordinate SVG di Grating.vue (mm). cavities =
// [{tipo:'rect', x, y, w, h} | {tipo:'circle', cx, cy, r}] con il FRANCO gia'
// dentro (util/cavityClearance.js). Per ogni tasca:
//   fori:    distanza bordo cavita' - centro foro >= r + web;
//   profilo: la cavita' sta dentro il profilo, ad almeno web dai lati.
// Ritorna [{ index, foro: bool, profilo: bool }] solo per le tasche in
// conflitto (index 0-based = SUB_POS - 1). Solo avviso, mai blocco.
export function pocketsVsBase(base, cavities, web = BASE_WEB_MM) {
	if (!base || !base.profile) return [];
	const poly = profilePoints(base.profile).map(p => ({ x: p.x, y: -p.y }));
	const holes = (base.holes || []).map(h => ({ x: h.cx, y: -h.cy, r: h.r }));
	const lati = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
	const out = [];
	(cavities || []).forEach((cv, index) => {
		let foro = false, profilo = false;
		if (cv.tipo === 'rect') {
			const ang = [{ x: cv.x, y: cv.y }, { x: cv.x + cv.w, y: cv.y }, { x: cv.x + cv.w, y: cv.y + cv.h }, { x: cv.x, y: cv.y + cv.h }];
			foro = holes.some(h => distPuntoRett(h, cv) < h.r + web);
			const bordi = ang.map((p, i) => [p, ang[(i + 1) % 4]]);
			profilo = !ang.every(p => insidePolygon(p, poly))
				|| lati.some(([a, b]) => bordi.some(([c, d]) => distSegmenti(a, b, c, d) < web));
		} else {
			const ctr = { x: cv.cx, y: cv.cy };
			foro = holes.some(h => Math.hypot(h.x - ctr.x, h.y - ctr.y) - cv.r < h.r + web);
			profilo = !insidePolygon(ctr, poly) || lati.some(([a, b]) => distPuntoSegmento(ctr, a, b) - cv.r < web);
		}
		if (foro || profilo) out.push({ index, foro, profilo });
	});
	return out;
}
