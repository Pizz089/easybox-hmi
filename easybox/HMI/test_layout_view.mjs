// ============================================================================
// test_layout_view.mjs — layout cassetto (layoutView.vue) con i dati REALI di
// TRAY_9 (corretti a DB, validati sul robot): le tasche vanno disegnate con
// l'inversa della convenzione di gratingAxes, senza filtri sul segno.
//
// Uso:   node test_layout_view.mjs     (dalla cartella easybox/HMI)
// Exit code 0 = tutti i check passati, 1 = almeno un check fallito.
// ============================================================================
process.on('unhandledRejection', () => {});
globalThis.window = { location: { hostname: 'localhost' } };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

import { readFileSync } from 'node:fs';
const { createServer } = await import('vite');
const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const { drawingToRobot, ROBOT_AXIS_ALONG } = await server.ssrLoadModule('/src/util/gratingAxes.js');
const comp = (await server.ssrLoadModule('/src/views/layoutView.vue')).default;
const src = readFileSync('src/views/layoutView.vue', 'utf8');

let failed = 0;
const check = (c, l) => { console.log((c ? '  ok   ' : '  FAIL ') + l); if (!c) failed++; };

// dati REALI di TRAY_9 come li ritorna api/conf/tray/layout (x,y in mm =
// POSITION.X/Y / 1000, ordinati per SUB_POS): 13 x 7, riferimento validato
const rows = [];
for (let i = 0; i < 91; i++) {
	const col = Math.floor(i / 13), row = i % 13;
	rows.push({ partType: 1030, prisma: 1, x: (50000 + 80000 * col) / 1000, y: (-65000 + 60000 * row) / 1000, status: 5, order_ID: 0, FLOOR_MAG: 9 });
}
check(rows[0].x === 50 && rows[0].y === -65 && rows[1].y === -5 && rows[13].x === 130 && rows[90].x === 530 && rows[90].y === 655, 'dataset = riferimento (1:(50,-65) 2:(50,-5) 14:(130,-65) 91:(530,655))');

const vm = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods)) vm[k] = f.bind(vm);
for (const [k, c] of Object.entries(comp.computed || {}))
	Object.defineProperty(vm, k, { get: () => (typeof c === 'function' ? c.call(vm) : c.get.call(vm)) });
vm.listPz = rows;
vm.dim_x = 40; vm.dim_y = 70;   // pezzo 40x70 (api/conf/piece)

console.log('\n1) template: niente filtri di segno, disegno da drawPz');
// template senza i commenti HTML (che citano i vecchi filtri per storia)
const tpl = src.slice(0, src.lastIndexOf('</template>')).replace(/<!--[\s\S]*?-->/g, '');
check(!/p\.y<0|p\.y>0|p\.x>0/.test(tpl), 'rimossi i v-if p.x>0 / p.y<0 / p.y>0');
check(/v-for="\(p, index\) in drawPz"/.test(tpl) && /:x="p\.w-dim_x\/2" :y="p\.h-dim_y\/2"/.test(tpl), 'prisma posizionato da p.w/p.h');
check(/import \{ DIR_X, DIR_Y, ROBOT_AXIS_ALONG \} from '\.\.\/util\/gratingAxes\.js'/.test(src), 'versi importati da gratingAxes (nessuna costante duplicata)');

console.log('\n2) drawPz con TRAY_9: tasca 1 e 2 adiacenti sullo stesso asse schermo');
const d = vm.drawPz;
check(d.length === 91, '91 tasche disegnate (prima: solo le 7 con Y<0)');
check(d[0].w === 50 && d[0].h === 65, 'tasca 1 a (w=50, h=65)');
check(d[1].h === d[0].h && d[1].w - d[0].w === 60, 'tasca 2 stessa riga schermo (h uguale), 60 mm piu\' a destra (= 40 + SAFEX 20)');
check(d[12].w === 770 && d[12].h === 65, 'tasca 13 a (770, 65): fine della riga');
check(d[13].w === 50 && d[13].h === 145, 'tasca 14 a (50, 145): riga successiva (+80 = 70 + SAFEY 10)');
check(d[90].w === 770 && d[90].h === 545, 'tasca 91 a (770, 545)');
const ws = [...new Set(d.map(p => p.w))], hs = [...new Set(d.map(p => p.h))];
check(ws.length === 13 && hs.length === 7, 'griglia 13 (orizzontale) x 7 (verticale)');
check(ROBOT_AXIS_ALONG.width === 'Y' && ROBOT_AXIS_ALONG.height === 'X', 'orizzontale = lato lungo = asse robot Y; verticale = asse robot X');

console.log('\n3) ingombro disegnato dentro il contorno 820 x 615, quasi pieno');
const minW = Math.min(...ws) - 20, maxW = Math.max(...ws) + 20;
const minH = Math.min(...hs) - 35, maxH = Math.max(...hs) + 35;
check(minW >= 0 && maxW <= 820 && minH >= 0 && maxH <= 615, 'tutto dentro: w ' + minW + '..' + maxW + ', h ' + minH + '..' + maxH);
check((maxW - minW) / 820 > 0.9 && (maxH - minH) / 615 > 0.85, 'occupa il ' + Math.round((maxW - minW) / 8.2) + '% in larghezza e il ' + Math.round((maxH - minH) / 6.15) + '% in altezza');

console.log('\n4) coerenza: l\'inversa riporta esattamente le coordinate robot');
const back = drawingToRobot(d.map(p => ({ w: p.w, h: p.h })));
check(back.every((p, i) => p.X === Math.round(rows[i].x * 1000) && p.Y === Math.round(rows[i].y * 1000)), 'drawingToRobot(drawPz) == coordinate lette, tutte le 91');

console.log('\n5) grigliato importato (partType 0): passo dedotto sugli assi giusti');
const vm0 = Object.assign({}, comp.data.call({}));
for (const [k, f] of Object.entries(comp.methods)) vm0[k] = f.bind(vm0);
vm0.listPz = rows;
// replica del ramo partType==0 (senza rete): SAFEX 20, SAFEY 10
const dd = vm0.listPz;
const dimx = Math.abs(dd[1].y - dd[0].y) - 20, other = dd.find(p => p.x != dd[0].x), dimy = Math.abs(other.x - dd[0].x) - 10;
check(dimx === 40 && dimy === 70, 'dim_x=40 (da SUB_POS 1->2 su Y robot), dim_y=70 (da prima tasca con X diversa)');
check(/Math\.abs\(d\[1\]\.y - d\[0\]\.y\)/.test(src) && /p\.x != d\[0\]\.x/.test(src), 'il codice usa proprio questa deduzione');

await server.close();
console.log('\n' + (failed ? failed + ' CHECK FALLITI' : 'TUTTI I CHECK PASSATI'));
process.exit(failed ? 1 : 0);
