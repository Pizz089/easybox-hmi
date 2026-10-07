// ============================================================================
// test_grating_base_route.js — GET /api/conf/grating/base (CONF/Grating.js,
// 7/10): il backend serve il Base.dxf della cartella Grating_model_dir.
//
//   1. file presente: 200, testo grezzo, Cache-Control no-store, data di
//      modifica, dimensione e percorso negli header; letto a OGNI richiesta
//      (un file sostituito vale subito);
//   2. file assente: 404 BASE_DXF_MISSING col percorso cercato;
//   3. file oltre 5 MB: 413 BASE_DXF_TOO_LARGE;
//   4. Grating_model_dir non impostata: 500 BASE_DIR_UNSET, nessuna cartella
//      di ripiego;
//   5. la cartella del .env finisce con "\": il percorso si compone con
//      path.join.
//
// Il file di prova e' SINTETICO e vive in una cartella temporanea del
// sistema, cancellata alla fine: nessun Base.dxf nel repo.
//
// Uso:   node test_grating_base_route.js
// NON richiede DB: mssql/express/DBFunct/LogFunct sono stub.
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================

const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');

const routes = {};
const fakeRouter = () => {
	const reg = method => (p, h) => { routes[method + ' ' + p] = h; };
	return { get: reg('GET'), post: reg('POST'), delete: reg('DELETE'), put: reg('PUT') };
};
const origLoad = Module._load;
Module._load = function (req) {
	if (req === 'express') return Object.assign(() => {}, { Router: fakeRouter, static: () => {} });
	if (req === 'mssql') return { connect: (cfg, cb) => cb(null), Request: function () { this.query = (q, cb) => cb(null, { recordset: [] }); } };
	if (req.endsWith('DBFunct')) return { configDB: {}, io: { emit: () => {}, on: () => {} } };
	if (req.endsWith('LogFunct')) return { standard: () => {}, error: () => {}, info: () => {}, init: () => {} };
	return origLoad.apply(this, arguments);
};
require(path.join(__dirname, 'CONF', 'Grating.js'));

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// chiama la route e aspetta la risposta (fs.stat/readFile sono asincroni)
function chiama() {
	return new Promise(resolve => {
		const res = {
			code: 200, headers: {}, body: null, tipo: null,
			set(k, v) { this.headers[k.toLowerCase()] = v; return this; },
			status(c) { this.code = c; return this; },
			type(t) { this.tipo = t; return this; },
			json(b) { this.body = b; resolve(this); return this; },
			send(b) { this.body = b; resolve(this); return this; },
		};
		routes['GET /base']({ query: {}, params: {} }, res);
	});
}

(async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grating-base-'));
	const file = path.join(dir, 'Base.dxf');
	const finto = '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n';
	try {
		check(typeof routes['GET /base'] === 'function', 'route GET /base registrata');

		console.log('1) file presente');
		process.env.Grating_model_dir = dir + path.sep;          // come nel .env: finisce con "\"
		fs.writeFileSync(file, finto);
		let r = await chiama();
		check(r.code === 200 && Buffer.isBuffer(r.body) && r.body.toString('utf8') === finto, '200 col testo grezzo del file');
		check(r.headers['cache-control'] === 'no-store', 'Cache-Control: no-store');
		check(/^text\/plain/.test(r.tipo), 'Content-Type text/plain');
		const st = fs.statSync(file);
		check(r.headers['last-modified'] === st.mtime.toUTCString() && r.headers['x-base-size'] === String(st.size), 'data di modifica e dimensione negli header');
		check(decodeURIComponent(r.headers['x-base-path']) === file, 'percorso del file (path.join, niente doppia barra) in X-Base-Path');
		const nuovo = finto.replace('ENTITIES', 'ENTITIES\n0\nCIRCLE');
		fs.writeFileSync(file, nuovo);
		r = await chiama();
		check(r.body.toString('utf8') === nuovo, 'file sostituito: la richiesta dopo legge quello nuovo (nessuna cache nel backend)');

		console.log('\n2) file assente');
		fs.unlinkSync(file);
		r = await chiama();
		check(r.code === 404 && r.body.error === 'BASE_DXF_MISSING' && r.body.path === file, '404 BASE_DXF_MISSING col percorso cercato');
		check(r.headers['cache-control'] === 'no-store', '   anche l\'errore senza cache');
		fs.mkdirSync(file);
		r = await chiama();
		check(r.code === 404 && r.body.error === 'BASE_DXF_MISSING', 'una cartella chiamata Base.dxf non e\' il file: 404');
		fs.rmdirSync(file);

		console.log('\n3) file troppo grande');
		fs.writeFileSync(file, Buffer.alloc(5 * 1024 * 1024 + 1, 0x20));
		r = await chiama();
		check(r.code === 413 && r.body.error === 'BASE_DXF_TOO_LARGE' && r.body.path === file && r.body.size === 5 * 1024 * 1024 + 1, '413 BASE_DXF_TOO_LARGE oltre 5 MB');
		fs.writeFileSync(file, Buffer.alloc(5 * 1024 * 1024, 0x20));
		r = await chiama();
		check(r.code === 200, '5 MB esatti: servito');

		console.log('\n4) Grating_model_dir non impostata');
		for (const v of [undefined, '', '   ']) {
			if (v === undefined) delete process.env.Grating_model_dir; else process.env.Grating_model_dir = v;
			r = await chiama();
			check(r.code === 500 && r.body.error === 'BASE_DIR_UNSET' && !r.body.path, '500 BASE_DIR_UNSET con ' + JSON.stringify(v) + ', nessuna cartella di ripiego');
		}

		console.log('\n5) sorgente');
		const src = fs.readFileSync(path.join(__dirname, 'CONF', 'Grating.js'), 'utf8');
		const corpo = src.slice(src.indexOf("router.get('/base'"), src.indexOf("router.post('/saveModel"));
		check(/path\.join\(dir, 'Base\.dxf'\)/.test(corpo), 'percorso composto con path.join');
		check(!/readFileSync|statSync/.test(corpo) && /fs\.stat\(/.test(corpo) && /fs\.readFile\(/.test(corpo), 'letto a ogni richiesta, senza bloccare il backend');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
	console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
	process.exit(failed ? 1 : 0);
})();
