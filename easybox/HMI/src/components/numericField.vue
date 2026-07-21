<script setup>
    // (AL 2c) Campo numerico condiviso (Grating, GratingTest, ImportGrating,
    // Tray). Contratto emit: SEMPRE un NUMERO clampato [min..max] — mai
    // stringhe (il vecchio @input emetteva la stringa raw del DOM: nei
    // consumer finiva in aritmetica e CONCATENAVA invece di sommare, per
    // questo la tastiera non ricalcolava come i +/-).
    import { dataStored } from '../data.js'
</script>

<template>
    <span class="numeric-field">
        <button type="button" class="changeValue" @click="dec" :disabled="dataStored.userLevel==0">
            <strong>&minus;</strong>
        </button>
        <input  type="number"
                class="num-input"
                :name="name"
                :value="modelValue"
                @input="onInput"
                @change="onCommit"
                :readonly="dataStored.userLevel==0"
                :class="{'error':(parseFloat(modelValue)<parseFloat(min)||parseFloat(modelValue)>parseFloat(max))}"
                :min="min"
                :max="max" />
        <button type="button" class="changeValue" @click="inc" :disabled="dataStored.userLevel==0">
            <strong>+</strong>
        </button>
        <span v-if="unitMeasure!=undefined" class="unit-label">
            {{unitMeasure}}
        </span>
    </span>
</template>

<script>
  export default {
    name: "numericField",
    emits: ['update'],
    props: {
        name: String,
        unitMeasure: String,
        min:String,
        max:String,
        step:String,
        modelValue:Number,
        integerVal:Boolean
    },
    methods: {
        parseVal(v) {
            const n = this.integerVal ? parseInt(v, 10) : parseFloat(v);
            return Number.isFinite(n) ? n : null;
        },
        // clamp [min..max]: vale per digitazione, +/- e commit
        clampVal(n) {
            const mn = parseFloat(this.min), mx = parseFloat(this.max);
            if (Number.isFinite(mn) && n < mn) n = mn;
            if (Number.isFinite(mx) && n > mx) n = mx;
            return this.integerVal ? Math.round(n) : n;
        },
        // tastiera = spinner: ogni digitazione valida emette il numero clampato
        onInput(e) {
            const n = this.parseVal(e.target.value);
            if (n === null) return;            // vuoto/parziale: nessun emit
            this.$emit('update', this.clampVal(n));
        },
        // fine editing (blur/invio): riallinea anche il DOM al valore clampato
        // (se il clamp non cambia modelValue, Vue non re-renderizza il campo)
        onCommit(e) {
            const n = this.parseVal(e.target.value);
            const v = this.clampVal(n === null ? (this.parseVal(this.min) ?? 0) : n);
            this.$emit('update', v);
            e.target.value = v;
        },
        inc() {
            const cur = this.parseVal(this.modelValue) ?? 0;
            const st = this.parseVal(this.step) ?? 1;
            this.$emit('update', this.clampVal(cur + st));
        },
        dec() {
            const cur = this.parseVal(this.modelValue) ?? 0;
            const st = this.parseVal(this.step) ?? 1;
            this.$emit('update', this.clampVal(cur - st));
        }
    }
  };
  </script>

<style scoped>
    .numeric-field{
        display: inline-flex;
        align-items: center;
        gap: var(--space-1); /* micro-aggiustamento ottico spinner-campo */
    }

    /* (AL 2c) spinner a design system: variante compatta da form
       (era lightsteelblue/2em) — touch 44, token, coerente coi campi */
    .changeValue{
        min-width: 44px;
        min-height: 44px;
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--font-size-md);
        cursor: pointer;
        transition: filter var(--transition-fast);
    }

    .changeValue:hover:not(:disabled){
        filter: brightness(1.15);
    }

    .changeValue:disabled{
        opacity: 0.5;
        cursor: not-allowed;
    }

    .num-input{
        box-sizing: border-box;
        width: 226px;              /* larghezza storica dei consumer */
        min-height: 44px;
        text-align: center;
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: var(--font-size-base);
        transition: border-color var(--transition-fast);
    }

    .num-input:focus{
        outline: none;
        border-color: var(--accent);
    }

    .unit-label{
        color: var(--text-muted);
        font-size: var(--font-size-sm);
    }

    .error{
        background-color: var(--color-danger-bg);
        animation: blinker 0.2s linear;
        animation-iteration-count: 4;
        font-weight: bold;
    }
    @keyframes blinker {
        0% {
            opacity: 0;
        }

    }
</style>
