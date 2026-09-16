// ============================================================================
// trayPockets.js — caricamento delle tasche di UN cassetto
//
// PERCHE' ESISTE. Il disegno delle tasche viveva tutto dentro layoutView, dati
// compresi. Il dialog "Reimposta stato cella" deve mostrare la STESSA griglia
// per correggere una tasca alla volta (comando 39): due copie della stessa
// lettura sarebbero divergute al primo ritocco. Qui c'e' la lettura, in
// TrayPockets.vue c'e' il disegno, e nessuno dei due sa niente dell'altro.
//
// Le quote arrivano in mm dall'endpoint (x_pick/1000): restano in mm, come
// prima. Chi disegna le riporta in micron per gratingAxes.
// ============================================================================

// Righe duplicate per SUB_POS falserebbero etichette, click e salvataggi
// (tutto mappato per indice): si tiene la prima e si CONTA l'anomalia, che il
// chiamante decide come segnalare. Mai disegnarla in silenzio.
function dedup(rows) {
	const seen = new Set();
	const out = [];
	let dups = 0;
	for (const p of (rows || [])) {
		if (p.SUB_POS != null && seen.has(p.SUB_POS)) { dups++; continue; }
		seen.add(p.SUB_POS);
		out.push(p);
	}
	return { rows: out, dups };
}

function getJson(url) {
	return fetch(url, { method: 'GET' }).then(r => {
		if (!r.ok) throw new Error('Network response was not ok');
		return r.json();
	});
}

// Il passo del disegno dipende da COSA c'e' nel cassetto:
// - partType 0 = grigliato importato dal mondo reale: il passo si deduce dalle
//   tasche stesse (SUB_POS consecutive avanzano sull'asse robot Y = larghezza
//   del disegno; la prima tasca con X diversa da' il passo in altezza) e si
//   toglie il margine anti-urto SAFEX/SAFEY;
// - altrimenti il pezzo ha le sue quote in anagrafica.
function dimsFromGrating(server, floorMag, rows) {
	return getJson(server + 'api/conf/grating/showFromTray/' + floorMag).then(dim => {
		const d = rows;
		const dimX = (d.length > 1 ? Math.abs(d[1].y - d[0].y) : 0) - dim[0].SAFEX;
		const other = d.find(p => p.x != d[0].x);
		const dimY = (other ? Math.abs(other.x - d[0].x) : 0) - dim[0].SAFEY;
		return { dimX, dimY, radius: Math.round(dimX / 2) };
	});
}

function dimsFromPiece(server, partType) {
	return getJson(server + 'api/conf/piece/show/' + partType).then(dim => ({
		dimX: dim[0].X / 1000,
		dimY: dim[0].Y / 1000,
		radius: Math.round((dim[0].X / 1000) / 2)
	}));
}

// Risolve SEMPRE (mai una rejection non gestita): un cassetto vuoto o una
// lettura fallita danno righe vuote, non un'eccezione da inseguire.
export function loadTrayPockets(server, floorMag) {
	return getJson(server + 'api/conf/tray/layout/' + floorMag)
		.then(pz => {
			const { rows, dups } = dedup(pz);
			if (rows.length === 0) return { rows, dups, dimX: 0, dimY: 0, radius: 0 };
			const dims = rows[0].partType == 0
				? dimsFromGrating(server, floorMag, rows)
				: dimsFromPiece(server, rows[0].partType);
			return dims
				.then(d => Object.assign({ rows, dups }, d))
				.catch(() => ({ rows, dups, dimX: 0, dimY: 0, radius: 0 }));
		})
		.catch(() => ({ rows: [], dups: 0, dimX: 0, dimY: 0, radius: 0 }));
}
