<!--
  StatoElenco.vue — cosa si legge quando un elenco non ha righe
  (usabilita' 15/9)

  Tre situazioni diverse che prima si vedevano tutte uguali, cioe' una tabella
  senza righe:
    - richiesta in corso   -> si dice che sta caricando, e non si dice "vuoto"
    - elenco davvero vuoto -> il messaggio della pagina ("nessun cassetto...")
    - guasto               -> si dice il motivo E cosa fare, con Riprova

  MODELLO: la frase degli attrezzaggi incompleti nel wizard ordini, che dice
  il motivo e poi cosa fare ("Morsa senza attrezzatura associata: il PLC non
  sa a che quota depositare. Completare dalla Modifica"). E' il livello a cui
  devono arrivare tutti i messaggi del pannello.
-->
<template>
  <div class="stato-elenco" v-if="stato !== 'ok' || vuoto">
    <!-- in corso: non si afferma niente finche' non si sa -->
    <p v-if="stato === 'attesa'" class="stato-attesa">{{ $t('elenco.attesa') }}</p>

    <!-- guasto: motivo, conseguenza, cosa fare -->
    <div v-else-if="stato === 'irraggiungibile' || stato === 'guasto'" class="stato-guasto">
      <p class="stato-motivo">{{ $t(stato === 'irraggiungibile' ? 'elenco.irraggiungibile' : 'elenco.guasto') }}</p>
      <p class="stato-daFare">{{ $t(stato === 'irraggiungibile' ? 'elenco.irraggiungibileDaFare' : 'elenco.guastoDaFare') }}</p>
      <button type="button" class="pure-button pure-button-primary" @click="$emit('riprova')">
        {{ $t('elenco.riprova') }}
      </button>
    </div>

    <!-- vuoto davvero: il messaggio lo passa la pagina, che sa di cosa parla -->
    <p v-else class="stato-vuoto">{{ messaggioVuoto }}</p>
  </div>
</template>

<script>
export default {
  name: 'StatoElenco',
  props: {
    // 'attesa' | 'ok' | 'irraggiungibile' | 'guasto'
    stato: { type: String, default: 'attesa' },
    vuoto: { type: Boolean, default: false },
    messaggioVuoto: { type: String, default: '' },
  },
  emits: ['riprova'],
};
</script>

<style scoped>
.stato-elenco {
  padding: var(--space-5) var(--space-4);
  text-align: center;
}

.stato-attesa,
.stato-vuoto {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-base);
}

/* il guasto si vede: stessa coppia colore/fondo degli avvisi del pannello */
.stato-guasto {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: 44rem;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-warning-bg);
}

.stato-motivo {
  margin: 0;
  color: var(--color-warning);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
}

.stato-daFare {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
}

.stato-guasto .pure-button {
  min-height: 52px;
  min-width: 10rem;
}
</style>
