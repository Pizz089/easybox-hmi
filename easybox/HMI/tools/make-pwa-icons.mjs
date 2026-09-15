// ============================================================================
// make-pwa-icons.mjs — genera le icone PWA da src/assets/logo.png
//
// PERCHE' ESISTE: il logo e' un banner 500x133, le icone PWA devono essere
// QUADRATE. Serve quindi comporre il logo su una tela quadrata, e servono tre
// misure diverse. Rifare il conto a mano ogni volta che il logo cambia e'
// lavoro perso, e ridedurre un codec PNG ancora di piu': meglio uno script.
//
// PERCHE' SENZA DIPENDENZE: sul PC di sviluppo non ci sono ne' ImageMagick ne'
// Pillow, e aggiungere una dipendenza npm solo per tre file generati una volta
// l'anno peserebbe piu' di quanto risolve. zlib sta gia' in Node, e il PNG che
// serve qui e' il caso semplice (8 bit, non interlacciato).
//
// USO:   node tools/make-pwa-icons.mjs
//        node tools/make-pwa-icons.mjs --info      (solo diagnosi del logo)
// Scrive in public/: pwa-192.png, pwa-512.png, pwa-maskable-512.png
//
// MASKABLE: Android ritaglia l'icona nella forma del lanciatore (cerchio,
// squircle, goccia). La zona sicura e' il cerchio centrale dell'80%, quindi
// nell'icona maskable il logo sta molto piu' piccolo e il fondo arriva ai
// bordi. Senza una maskable, Android aggiunge lui un fondo bianco e l'icona
// risulta piccola e centrata male.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src', 'assets', 'logo.png');
const OUT = join(ROOT, 'public');

// FONDO SCURO, e non e' una preferenza estetica: il logo e' bianco con un
// segno rosso su trasparente (diagnosi con --info: 77% trasparente, colori
// opachi dominanti #E0E0E0 e #E00000). Su fondo bianco la scritta sparirebbe.
// Il valore e' --bg del tema scuro del pannello (assets/base.css), lo stesso
// di background_color e theme_color nel manifest, cosi' l'icona, la schermata
// di avvio e la pagina sono la stessa tinta.
const BG = [0x0b, 0x0f, 0x14, 0xff];

// ------------------------------------------------------------------ decode
function decodePng(buf) {
	const sig = [137, 80, 78, 71, 13, 10, 26, 10];
	for (let i = 0; i < 8; i++)
		if (buf[i] !== sig[i]) throw new Error('non e\' un PNG');
	let p = 8, ihdr = null;
	const idat = [];
	while (p < buf.length) {
		const len = buf.readUInt32BE(p);
		const type = buf.toString('ascii', p + 4, p + 8);
		const data = buf.subarray(p + 8, p + 8 + len);
		if (type === 'IHDR')
			ihdr = {
				w: data.readUInt32BE(0), h: data.readUInt32BE(4),
				depth: data[8], color: data[9], interlace: data[12],
			};
		else if (type === 'IDAT') idat.push(data);
		else if (type === 'IEND') break;
		p += 12 + len;
	}
	if (!ihdr) throw new Error('IHDR mancante');
	if (ihdr.depth !== 8 || ihdr.interlace !== 0 || (ihdr.color !== 6 && ihdr.color !== 2))
		throw new Error('supportati solo PNG 8 bit non interlacciati RGB/RGBA (trovato depth=' + ihdr.depth + ' color=' + ihdr.color + ' interlace=' + ihdr.interlace + ')');

	const bpp = ihdr.color === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = ihdr.w * bpp;
	const out = Buffer.alloc(ihdr.w * ihdr.h * 4);
	let prev = Buffer.alloc(stride);
	for (let y = 0; y < ihdr.h; y++) {
		const ft = raw[y * (stride + 1)];
		const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
		// ricostruzione dei filtri PNG (spec 9.2): ogni riga e' codificata
		// rispetto al pixel a sinistra, a quello sopra, o alla loro media
		for (let i = 0; i < stride; i++) {
			const a = i >= bpp ? line[i - bpp] : 0;
			const b = prev[i];
			const c = i >= bpp ? prev[i - bpp] : 0;
			let v = line[i];
			if (ft === 1) v += a;
			else if (ft === 2) v += b;
			else if (ft === 3) v += (a + b) >> 1;
			else if (ft === 4) {
				const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			} else if (ft !== 0) throw new Error('filtro PNG sconosciuto: ' + ft);
			line[i] = v & 0xff;
		}
		for (let x = 0; x < ihdr.w; x++) {
			const s = x * bpp, d = (y * ihdr.w + x) * 4;
			out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2];
			out[d + 3] = bpp === 4 ? line[s + 3] : 255;
		}
		prev = line;
	}
	return { w: ihdr.w, h: ihdr.h, data: out };
}

// ------------------------------------------------------------------ encode
const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();
const crc32 = (b) => {
	let c = 0xffffffff;
	for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}
function encodePng({ w, h, data }) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	const stride = w * 4;
	const raw = Buffer.alloc((stride + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (stride + 1)] = 0; // filtro "None": le icone sono piccole
		data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

// --------------------------------------------------------------- resample
// media di area, con alpha premoltiplicata: senza premoltiplicare, i pixel
// trasparenti tirerebbero il colore verso il nero sui bordi del logo
function resize(img, tw, th) {
	const out = Buffer.alloc(tw * th * 4);
	const sx = img.w / tw, sy = img.h / th;
	for (let y = 0; y < th; y++) {
		const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * sy));
		for (let x = 0; x < tw; x++) {
			const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * sx));
			let r = 0, g = 0, b = 0, a = 0, n = 0;
			for (let yy = y0; yy < Math.min(y1, img.h); yy++)
				for (let xx = x0; xx < Math.min(x1, img.w); xx++) {
					const s = (yy * img.w + xx) * 4, al = img.data[s + 3];
					r += img.data[s] * al; g += img.data[s + 1] * al; b += img.data[s + 2] * al;
					a += al; n++;
				}
			const d = (y * tw + x) * 4;
			out[d] = a ? Math.round(r / a) : 0;
			out[d + 1] = a ? Math.round(g / a) : 0;
			out[d + 2] = a ? Math.round(b / a) : 0;
			out[d + 3] = n ? Math.round(a / n) : 0;
		}
	}
	return { w: tw, h: th, data: out };
}

// tela quadrata di fondo + logo centrato, largo `coverage` della tela
function square(logo, size, coverage) {
	const data = Buffer.alloc(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		data[i * 4] = BG[0]; data[i * 4 + 1] = BG[1];
		data[i * 4 + 2] = BG[2]; data[i * 4 + 3] = BG[3];
	}
	const lw = Math.max(1, Math.round(size * coverage));
	const lh = Math.max(1, Math.round((lw * logo.h) / logo.w));
	const sc = resize(logo, lw, lh);
	const ox = Math.round((size - lw) / 2), oy = Math.round((size - lh) / 2);
	for (let y = 0; y < lh; y++)
		for (let x = 0; x < lw; x++) {
			const s = (y * lw + x) * 4, d = ((y + oy) * size + (x + ox)) * 4;
			const a = sc.data[s + 3] / 255;
			for (let k = 0; k < 3; k++)
				data[d + k] = Math.round(sc.data[s + k] * a + data[d + k] * (1 - a));
			data[d + 3] = 255;
		}
	return { w: size, h: size, data };
}

// ------------------------------------------------------------------- main
const logo = decodePng(readFileSync(SRC));
if (process.argv.includes('--info')) {
	let dark = 0, light = 0, clear = 0;
	for (let i = 0; i < logo.w * logo.h; i++) {
		const a = logo.data[i * 4 + 3];
		if (a < 32) { clear++; continue; }
		const lum = 0.2126 * logo.data[i * 4] + 0.7152 * logo.data[i * 4 + 1] + 0.0722 * logo.data[i * 4 + 2];
		if (lum < 128) dark++; else light++;
	}
	const pct = (n) => Math.round((n * 100) / (logo.w * logo.h)) + '%';
	console.log('logo', logo.w + 'x' + logo.h, 'trasparente', pct(clear), 'scuro', pct(dark), 'chiaro', pct(light));
	console.log('pixel angolo 0,0 =', [...logo.data.subarray(0, 4)].join(','));
	process.exit(0);
}

// 192 e 512 sono le due misure che Chrome pretende per poter installare.
// La maskable ha il logo al 55% perche' la zona sicura di Android e' il
// cerchio centrale dell'80%: quello che esce viene tagliato dal lanciatore.
for (const [file, size, coverage] of [
	['pwa-192.png', 192, 0.82],
	['pwa-512.png', 512, 0.82],
	['pwa-maskable-512.png', 512, 0.55],
]) {
	const png = encodePng(square(logo, size, coverage));
	writeFileSync(join(OUT, file), png);
	console.log('scritto public/' + file, '(' + size + 'x' + size + ', ' + png.length + ' byte)');
}
