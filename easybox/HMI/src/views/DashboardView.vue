<script setup>
// (v3 fase B) Home sulle tavole Main, Home43 e Tablet. Solo dati che
// esistono: ordini da api/order/show/all (vista WORKORDERS), misure del
// pezzo da api/conf/piece/show/<id>, stati delle unita' dallo store della
// shell (stessa fonte della striscia). Quello che nelle tavole non ha fonte
// (ciclo medio, fine stimata, grezzi disponibili, % e tempo residuo di MC1,
// contenuto del cassetto, "Pausa ordine") qui non c'e'.
import { dataStored } from '../data.js'
import { plant, activeAlarmUnits } from '../stores/plantStatus.js'
import { statusKey, statusTone } from '../util/unitStatus.js'
import { isMachineConfigured } from '../util/machineBrands'
import { caricaElenco, STATO, messaggioPer } from '../util/caricaElenco.js'
import CubeIcon3D from '../components/CubeIcon3D.vue'
import UiBadge from '../components/ui/UiBadge.vue'
import { Bot, Microwave, Server, ChevronRight, Square, ListOrdered, CircleX } from 'lucide-vue-next'
</script>

<template>
  <div class="home">

    <!-- ===== ORDINE IN CORSO =====
         L'ordine con STATUS = in lavorazione (3). "Ferma ordine" manda lo
         stesso comando del pulsante stop della tabella ordini (STATUS 4 su
         TO_PLANT/CMD/ORDER), senza conferma come la'. "Pausa" non c'e': non
         esiste un comando di pausa dell'ordine. -->
    <section class="home-card home-order">
      <header class="home-card__head">
        <span class="home-label">{{ $t('home.orderNow') }}<b v-if="ordineInCorso" class="home-label__id">#{{ ordineInCorso.ID }}</b></span>
        <template v-if="ordineInCorso">
          <UiBadge v-if="plant.robot == dataStored.status_hold" tone="warning">{{ $t('home.cellHold') }}</UiBadge>
          <UiBadge v-else tone="accent">{{ $t('home.working') }}</UiBadge>
        </template>
      </header>

      <template v-if="ordineInCorso">
        <div class="home-order__body">
          <div class="home-order__draw" v-if="pezzo">
            <CubeIcon3D :w="pezzo.X" :d="pezzo.Y" :h="pezzo.Z" :prisma="pezzo.PRISMA" :size="240" />
          </div>
          <div class="home-order__info">
            <div class="home-order__code">{{ ordineInCorso.PIECE }}</div>
            <div class="home-order__desc">
              {{ (ordineInCorso.PIECE_DESC || '').trim() }}<template v-if="pezzo"><span v-if="(ordineInCorso.PIECE_DESC || '').trim()"> · </span>{{ mm(pezzo.X) }} × {{ mm(pezzo.Y) }} × {{ mm(pezzo.Z) }} mm</template>
            </div>
            <dl class="home-facts">
              <div>
                <dt>{{ $t('home.machine') }}</dt>
                <dd>MC{{ ordineInCorso.MACHINE_ID }} · {{ $t('home.program', { pp: programma(ordineInCorso) }) }}</dd>
              </div>
              <div v-if="(ordineInCorso.GRIPPER || '').trim()">
                <dt>{{ $t('home.gripper') }}</dt>
                <dd>{{ pinza(ordineInCorso) }}</dd>
              </div>
              <div>
                <dt>{{ $t('home.rig') }}</dt>
                <dd>{{ $t('home.rigValue', { pallet: ordineInCorso.PALLET_ID, vice: ordineInCorso.VICE_ID }) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="home-count">
          <span class="home-count__n">{{ ordineInCorso.PRODUCTED }}</span>
          <span class="home-count__of">/ {{ ordineInCorso.QUANTITY }} {{ $t('home.pieces') }}</span>
        </div>
        <div class="home-bar"><i :style="{ width: avanzamento(ordineInCorso) + '%' }"></i></div>

        <div class="home-actions">
          <button type="button" class="home-btn"
            @click="modifyOrderStatus(ordineInCorso.ID,dataStored.status_raw,ordineInCorso.PIECE_ID)">
            <Square class="home-btn__stop" :stroke-width="0" aria-hidden="true" />{{ $t('home.stop') }}
          </button>
          <button type="button" class="home-btn home-btn--outline" @click="$router.push('/production')">
            {{ $t('home.queue') }}<ChevronRight :stroke-width="2" aria-hidden="true" />
          </button>
        </div>
      </template>

      <div v-else class="home-order__empty">
        <!-- "nessun ordine" solo con la risposta in mano; servizio muto o
             guasto si dice per quello che e' (util/caricaElenco.js) -->
        <p>{{ statoOrdini === STATO.OK ? $t('home.noOrder') : statoOrdini === STATO.ATTESA ? $t('home.loadingOrders') : $t(messaggioPer(statoOrdini)) }}</p>
        <button type="button" class="home-btn home-btn--outline" @click="$router.push('/production')">
          {{ $t('home.queue') }}<ChevronRight :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </section>

    <!-- ===== IN CODA (solo in largo) =====
         Gli ordini non finiti e non in lavorazione, nell'ordine di oggi
         (niente trascinamento: la coda non ha ancora un ordine suo). Una
         riga porta alla Produzione, dove stanno i comandi dell'ordine. -->
    <section class="home-card home-queue">
      <header class="home-card__head">
        <span class="home-label">{{ $t('home.inQueue') }}<span class="home-label__n">{{ $t('home.nOrders', { n: inCoda.length }) }}</span></span>
        <button type="button" class="home-link" @click="$router.push('/production')">{{ $t('home.seeAll') }}</button>
      </header>
      <div class="home-queue__list">
        <button v-for="o in inCoda" :key="o.ID" type="button" class="home-row" @click="$router.push('/production')">
          <span class="home-row__id">#{{ o.ID }}</span>
          <span class="home-row__piece"><b>{{ o.PIECE }}</b><small>{{ (o.PIECE_DESC || '').trim() }}</small></span>
          <span class="home-row__qty">{{ o.PRODUCTED }} / {{ o.QUANTITY }}</span>
          <span class="home-row__mc">MC{{ o.MACHINE_ID }}</span>
          <ChevronRight class="home-row__go" :stroke-width="2" aria-hidden="true" />
        </button>
        <p v-if="inCoda.length === 0" class="home-empty">{{ $t('home.queueEmpty') }}</p>
      </div>
    </section>

    <!-- ===== TILE DELLE UNITA' =====
         Stato dallo store della shell; la tile porta alla pagina Controlli
         dell'unita', come le card di prima (stesse rotte). MC1 senza anello
         ne' tempo residuo: non c'e' fonte. -->
    <div class="home-tiles">
      <button type="button" class="home-tile" @click="$router.push('/unit/robot');">
        <span class="home-tile__icon"><Bot :stroke-width="2" aria-hidden="true" /></span>
        <span class="home-tile__label">{{ $t('strip.robot') }}</span>
        <span class="home-tile__value" :class="'ctl-tone--' + statusTone(plant.robot)"><i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.robot)) }}</span></span>
        <span class="home-tile__sub" v-if="plant.robot == dataStored.status_alarm && parseInt(plant.robotAlarm) > 0">{{ $t('robot.alarm_' + parseInt(plant.robotAlarm)) }}</span>
        <span class="home-tile__sub" v-else-if="velocita">{{ $t('home.speed', { v: velocita }) }}</span>
        <ChevronRight class="home-tile__go" :stroke-width="2" aria-hidden="true" />
      </button>
      <button type="button" class="home-tile" v-if="isMachineConfigured(1)" @click="$router.push('/unit/cnc1');">
        <span class="home-tile__icon"><Microwave :stroke-width="2" aria-hidden="true" /></span>
        <span class="home-tile__label">{{ $t('nav.tab.mc1') }}</span>
        <span class="home-tile__value" :class="'ctl-tone--' + statusTone(plant.mc1)"><i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.mc1)) }}</span></span>
        <span class="home-tile__sub" v-if="ordineSu(1)">{{ $t('home.mcOrder', { id: ordineSu(1).ID }) }}</span>
        <ChevronRight class="home-tile__go" :stroke-width="2" aria-hidden="true" />
      </button>
      <button type="button" class="home-tile" v-if="isMachineConfigured(2)" @click="$router.push('/unit/cnc2');">
        <span class="home-tile__icon"><Microwave :stroke-width="2" aria-hidden="true" /></span>
        <span class="home-tile__label">{{ $t('nav.tab.mc2') }}</span>
        <span class="home-tile__value" :class="'ctl-tone--' + statusTone(plant.mc2)"><i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.mc2)) }}</span></span>
        <span class="home-tile__sub" v-if="ordineSu(2)">{{ $t('home.mcOrder', { id: ordineSu(2).ID }) }}</span>
        <ChevronRight class="home-tile__go" :stroke-width="2" aria-hidden="true" />
      </button>
      <button type="button" class="home-tile" @click="$router.push('/unit/smallbox');">
        <span class="home-tile__icon"><Server :stroke-width="2" aria-hidden="true" /></span>
        <span class="home-tile__label">{{ $t('strip.easybox') }}</span>
        <span class="home-tile__value" v-if="plant.trayOut > 0" :class="'ctl-tone--warning'"><i class="ctl-dot" aria-hidden="true"></i><span>{{ $t('strip.trayOut', { n: plant.trayOut }) }}</span></span>
        <span class="home-tile__value" v-else :class="'ctl-tone--' + statusTone(plant.box)"><i class="ctl-dot" aria-hidden="true"></i><span>{{ $t(statusKey(plant.box)) }}</span></span>
        <span class="home-tile__sub" v-if="plant.trayOut > 0">{{ $t(statusKey(plant.box)) }}</span>
        <ChevronRight class="home-tile__go" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>

    <!-- ===== ALLARMI ATTIVI (largo) =====
         Le unita' in stato di allarme, come la campanella (activeAlarmUnits):
         l'elenco del backend e' uno storico, senza un "risolto". -->
    <section class="home-card home-alarms">
      <header class="home-card__head">
        <span class="home-label">{{ $t('home.alarms') }}</span>
        <button type="button" class="home-link" @click="$router.push('/alarms')">{{ $t('home.openAlarms') }}</button>
      </header>
      <ul class="home-alarms__list" v-if="allarmi.length">
        <li v-for="a in allarmi" :key="a.unit">
          <span class="home-alarms__icon"><CircleX :stroke-width="2" aria-hidden="true" /></span>
          <span><b>{{ a.testo }}</b><small>{{ a.unit }}</small></span>
        </li>
      </ul>
      <p v-else class="home-empty">{{ $t('home.noAlarms') }}</p>
    </section>

    <!-- (compatto) un banner al posto della card: il primo allarme e quanti
         altri ce ne sono; porta alla pagina Allarmi -->
    <button v-if="allarmi.length" type="button" class="home-banner" @click="$router.push('/alarms')">
      <span class="home-alarms__icon"><CircleX :stroke-width="2" aria-hidden="true" /></span>
      <b>{{ allarmi[0].testo }}</b>
      <span class="home-banner__more" v-if="allarmi.length > 1">{{ $t('home.moreAlarms', { n: allarmi.length - 1 }) }}</span>
      <ChevronRight class="home-row__go" :stroke-width="2" aria-hidden="true" />
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      orders: [],
      // 'attesa' finche' non si sa: "nessun ordine in corso" solo con una
      // risposta in mano
      statoOrdini: STATO.ATTESA,
      pezzo: null,          // misure del pezzo dell'ordine in corso (micron)
      pezzoId: null,
    };
  },
  computed: {
    ordineInCorso() {
      return (this.orders || []).find(o => Number(o.STATUS) === dataStored.status_working) || null;
    },
    inCoda() {
      const corso = this.ordineInCorso;
      return (this.orders || []).filter(o => o !== corso && Number(o.STATUS) !== dataStored.status_finished && Number(o.STATUS) !== dataStored.status_working);
    },
    // eco CHANGESPEED (store della shell); senza eco niente velocita'
    velocita() {
      const v = parseInt(dataStored.robotSpeed);
      return v > 0 ? Math.min(100, v) : 0;
    },
    allarmi() {
      return activeAlarmUnits(isMachineConfigured(2)).map(u => {
        const code = parseInt(plant.robotAlarm);
        const testo = u === 'ROBOT' && code > 0 ? this.$t('robot.alarm_' + code) : this.$t('home.unitAlarm', { unit: u === 'BOX' ? 'EasyBox' : u });
        return { unit: u === 'BOX' ? 'EasyBox' : u === 'ROBOT' ? 'Robot' : u, testo };
      });
    },
  },
  watch: {
    // il pezzo si legge quando cambia l'ordine in corso, non a ogni giro
    ordineInCorso(o) { this.leggiPezzo(o); },
  },
  methods: {
    getOrders() {
      caricaElenco(dataStored.server, 'api/order/show/all').then(esito => {
        this.statoOrdini = esito.stato;
        if (esito.stato === STATO.OK) this.orders = esito.dati;
        else console.info('elenco ordini non letto: ' + esito.dettaglio);
      });
    },
    leggiPezzo(o) {
      const id = o ? o.PIECE_ID : null;
      if (id === this.pezzoId) return;
      this.pezzoId = id;
      this.pezzo = null;
      if (!(id > 0)) return;
      fetch(dataStored.server + 'api/conf/piece/show/' + id, { method: 'GET' })
        .then(r => { if (!r.ok) throw new Error('piece/show ' + r.status); return r.json(); })
        .then(rows => {
          const p = Array.isArray(rows) ? rows[0] : null;
          // solo se l'ordine in corso e' ancora quello
          if (p && this.pezzoId === id && p.X > 0 && p.Y > 0 && p.Z > 0) this.pezzo = p;
        })
        .catch(e => console.info('home: ' + e.message));
    },
    // stesso comando del pulsante stop della tabella ordini
    // (components/productionTable.vue)
    modifyOrderStatus(id, stat, pieceID) {
      dataStored.WS.socket.emit("TO_PLANT/CMD/ORDER",
        {
          id: id,
          status: stat,
          pieceID: pieceID
        }
      );
    },
    ordineSu(mc) {
      return (this.orders || []).find(o => Number(o.STATUS) === dataStored.status_working && Number(o.MACHINE_ID) === mc) || null;
    },
    // PP (path+name Heidenhain) vuoto per gli ordini a numero libero HAAS:
    // si mostra il numero PP_ID, come la tabella ordini
    pinza(o) {
      return [o.GRIPPER, o.GRIPPER_DESC].map(x => String(x || '').trim()).filter(Boolean).join(' ');
    },
    programma(o) {
      return (o.PP && String(o.PP).trim()) ? String(o.PP).trim() : o.PP_ID;
    },
    avanzamento(o) {
      const q = Number(o.QUANTITY) || 0;
      return q > 0 ? Math.min(100, Math.round(100 * (Number(o.PRODUCTED) || 0) / q)) : 0;
    },
    mm(v) {
      return Math.round((Number(v) || 0) / 100) / 10;
    },
  },
  mounted() {
    this.getOrders();
    this.productionChangedHandler = () => { this.getOrders(); };
    dataStored.WS.socket.on('PRODUCTION/CHANGED', this.productionChangedHandler);
  },
  unmounted() {
    // off SPECIFICO (evento + callback), come productionTable
    dataStored.WS.socket.off('PRODUCTION/CHANGED', this.productionChangedHandler);
  },
};
</script>

<style scoped>
/* Largo: ordine e coda a sinistra, tile e allarmi a destra (tavola Main).
   Compatto: una colonna, ordine -> tile -> banner allarme (Home43, Tablet).
   Niente scroll di pagina: le liste scorrono dentro la loro card. */
.home {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "order tiles" "queue alarms";
  gap: var(--space-5);
  height: 100%;
  min-height: 0;
}
.home-order { grid-area: order; }
.home-queue { grid-area: queue; }
.home-tiles { grid-area: tiles; }
.home-alarms { grid-area: alarms; }
.home-banner { display: none; }

.home-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--card-padding);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-sizing: border-box;
}
.home-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.home-label {
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.home-label__id,
.home-label__n {
  margin-left: var(--space-3);
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-secondary);
}
.home-label__id { font-weight: var(--font-weight-bold); }
.home-label__n { font-weight: var(--font-weight-semibold); }
.home-link {
  min-height: var(--touch-target-min);
  padding: 0 var(--space-2);
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

/* --- ordine in corso --- */
.home-order__body { display: flex; gap: var(--space-5); align-items: flex-start; }
.home-order__draw {
  flex: none;
  display: grid;
  place-items: center;
  width: 300px;
  height: 250px;
  overflow: hidden;
  border-radius: var(--radius-btn);
  background: var(--bg-input);
}
/* il solido di CubeIcon3D (stesso disegno della pagina Pezzi), piu' grande:
   grigi pieni come nella tavola (luce dall'alto), spigoli sottili */
.home-order__draw :deep(.face-top),
.home-order__draw :deep(.face-right),
.home-order__draw :deep(.face-left) { stroke: var(--bg-input); stroke-width: 0.45; }
.home-order__draw :deep(.face-top) { fill: var(--text-disabled); }
.home-order__draw :deep(.face-right) { fill: var(--border-default); }
.home-order__draw :deep(.face-left) { fill: var(--bg-segment-on); }
.home-order__info { min-width: 0; flex: 1; }
.home-order__code {
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-extrabold);
  line-height: 1.05;
}
.home-order__desc { margin-top: var(--space-1); font-size: var(--font-size-md); color: var(--text-secondary); }
.home-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4) var(--space-5);
  margin: var(--space-5) 0 0;
}
.home-facts dt {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.home-facts dd { margin: 2px 0 0; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
.home-count { display: flex; align-items: baseline; gap: var(--space-4); margin-top: var(--space-5); }
.home-count__n { font-size: var(--font-size-hero); font-weight: var(--font-weight-extrabold); line-height: 0.9; font-variant-numeric: tabular-nums; }
.home-count__of { font-size: var(--font-size-title); font-weight: var(--font-weight-bold); color: var(--text-secondary); }
.home-bar { height: 12px; margin-top: var(--space-4); border-radius: var(--radius-pill); background: var(--bg-input); overflow: hidden; }
.home-bar i { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
.home-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-5); }
.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: var(--touch-primary);
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--bg-surface-2);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}
.home-btn svg { width: 20px; height: 20px; }
.home-btn__stop { fill: var(--color-danger); }
.home-btn--outline { background: transparent; border: 1px solid var(--border-strong); }
.home-btn:hover { filter: brightness(1.12); }
.home-order__empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); }
.home-order__empty p { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--text-secondary); }

/* --- coda --- */
.home-queue__list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); }
.home-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 90px 70px 24px;
  align-items: center;
  gap: var(--space-4);
  min-height: 72px;
  padding: var(--space-2) var(--space-5);
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--bg-surface-2);
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.home-row__id { color: var(--text-muted); font-weight: var(--font-weight-semibold); }
.home-row__piece { display: flex; flex-direction: column; min-width: 0; }
.home-row__piece b, .home-row__piece small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.home-row__piece small { color: var(--text-secondary); font-size: var(--font-size-sm); }
.home-row__qty { font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; }
.home-row__mc { color: var(--text-secondary); }
.home-row__go, .home-tile__go { width: 20px; height: 20px; color: var(--text-muted); }
.home-empty { margin: 0; color: var(--text-muted); }

/* --- tile --- */
.home-tiles { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.home-tile {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  grid-template-areas: "icon label" "icon value" "icon sub";
  align-content: start;
  column-gap: var(--space-4);
  row-gap: var(--space-1);
  padding: var(--card-padding);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.home-tile:hover { background: var(--bg-surface-2); }
.home-tile__icon {
  grid-area: icon;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--bg-icon);
  color: var(--text-secondary);
}
.home-tile__icon svg { width: 26px; height: 26px; }
.home-tile__label {
  grid-area: label;
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-extrabold);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.home-tile__value {
  grid-area: value;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--font-size-state);
  font-weight: var(--font-weight-extrabold);
  line-height: var(--line-height-tight);
}
.home-tile__value > span { display: inline-block; }
.home-tile__value > span::first-letter { text-transform: uppercase; }
.home-tile__sub { grid-area: sub; font-size: var(--font-size-body); color: var(--text-secondary); }
.home-tile__go { position: absolute; top: var(--card-padding); right: var(--card-padding); }

/* --- allarmi --- */
.home-alarms__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto; min-height: 0; }
.home-alarms__list li { display: flex; gap: var(--space-4); align-items: center; }
.home-alarms__list li > span:last-child { display: flex; flex-direction: column; min-width: 0; }
.home-alarms__list small { color: var(--text-muted); }
.home-alarms__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
.home-alarms__icon svg { width: 22px; height: 22px; }

@media (max-width: 1599px) {
  .home {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    grid-template-areas: "order" "tiles" "banner";
    gap: var(--space-3);
    align-content: start;
  }
  .home-queue, .home-alarms { display: none; }
  .home-banner {
    grid-area: banner;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: 72px;
    padding: var(--space-3) var(--card-padding);
    border: 0;
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
    color: var(--text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .home-banner b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .home-banner__more { color: var(--text-muted); font-weight: var(--font-weight-semibold); }
  .home-card__head { margin-bottom: var(--space-3); }
  .home-order__body { gap: var(--space-4); }
  .home-order__draw { width: 168px; height: 128px; }
  .home-order__draw :deep(svg) { width: 150px; height: 150px; }
  .home-order__code { font-size: 30px; }
  .home-order__desc { font-size: var(--font-size-sm); }
  .home-facts { grid-template-columns: 1fr; gap: var(--space-1); margin-top: var(--space-2); }
  .home-facts > div { display: flex; gap: var(--space-2); align-items: baseline; }
  .home-facts dt { font-size: 11px; }
  .home-facts dd { font-size: var(--font-size-sm); }
  .home-count { margin-top: var(--space-3); }
  .home-count__of { font-size: 20px; }
  .home-bar { margin-top: var(--space-3); height: 10px; }
  .home-actions { margin-top: var(--space-3); gap: var(--space-3); }
  .home-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); grid-auto-flow: column; gap: var(--space-3); }
  .home-tile { grid-template-columns: 40px minmax(0, 1fr); grid-template-areas: "icon label" "value value" "sub sub"; row-gap: var(--space-2); padding: var(--space-4); }
  .home-tile__icon { width: 40px; height: 40px; }
  .home-tile__icon svg { width: 20px; height: 20px; }
  .home-tile__label { align-self: center; }
  .home-tile__value { font-size: 20px; }
  .home-tile__sub { font-size: var(--font-size-sm); }
  .home-tile__go { top: var(--space-4); right: var(--space-4); }
}
</style>
