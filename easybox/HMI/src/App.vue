<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { dataStored } from './data';
</script>

<template>
    <!--h3 v-if="!dataStored.WS.connected">in attesa di connessione</h3-->
    <component :is="$route.meta.layout || 'div'"> 
        <RouterView />
    </component>
</template>
 
<script>
    export default {
        data() {
            return {
                count :0,
                alarm: false,
            }
        },
        methods: {
            setAlarm(event) {
                this.alarm = !this.alarm;
            }
        },
        mounted(){
            dataStored.WS.socket = io(dataStored.WS.brokerURL);
            dataStored.WS.socket.on("connect", () => {
                dataStored.WS.connected = true;
            });
            dataStored.WS.socket.on("disconnect", () => {
                dataStored.WS.connected = false;
            });
        }
    }
</script>

<style>
    .pure-form-aligned .pure-control-group label {
        width:13em;
    }
    /* (UI 5/10) Comando bloccato: il livello richiesto (o la modalita' locale)
       e' un badge tondo sull'angolo in alto a destra del bottone, non piu' uno
       sfondo in basso a destra: sui bottoni tondi 48x48 il bordo lo tagliava e
       finiva sopra l'icona. Il ::after sta fuori dal bottone, quindi resta
       intero anche sui cerchi e sui bottoni disabilitati (il background
       !important dei disabled cancellava l'icona). Badge chiaro: le icone sono
       scure. Il rosa dei comandi di riga bloccati resta: e' lo stato. */
    #locked4OP,
    #cmdLocked4OP,
    #locked4maintenance,
    #lockedNotLocal{
        position: relative;
        overflow: visible;
    }
    #locked4OP::after,
    #cmdLocked4OP::after,
    #locked4maintenance::after,
    #lockedNotLocal::after{
        content: "";
        position: absolute;
        top: -6px;
        right: -6px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid var(--bg-base);
        background-color: var(--text-primary);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 14px;
        pointer-events: none;
    }
    #locked4OP::after{
        background-image:url('/src/assets/chiaveIng.svg');
    }
    #cmdLocked4OP::after,
    #locked4maintenance::after{
        background-image:url('/src/assets/laurea.png');
    }
    #lockedNotLocal::after{
        background-image:url('/src/assets/manuale_noBordo.png');
    }
    #cmdLocked4OP,
    #lockedNotLocal{
        background-color:rgb(232, 200, 200);
    }

    
    #hide{
    @media only screen and (max-width: 1224px) {
        display: none;
    }
    }

  .center {
    justify-content: center;
  }

  /* (UI v2 fase 1.4) tolto body { background-color: white }: il fondo lo
     da' custom-fix.css (--bg-base) e questo blocco, caricato dopo, lo
     ribaltava sul body (bianco visibile oltre l'altezza di #app). */

  .pure-table td {
    background-color: transparent;
  }
  .pure-table-odd td {
    background-color: transparent;
  }

  /* (UI 5/10) Card cliccabile: icona in alto a destra, dove la card non ha
     testo. In basso a destra finiva sopra l'ultima riga (es. "(ID 26)" nella
     coerenza pinza della pagina Robot). */
  .link{
    background-image:url('/src/assets/link.png');
    background-repeat: no-repeat;
    background-size: 1.25em;
    background-position: right 10px top 10px;
  }

  /* CARDS */
/* contatori del cassetto incoerenti (Tray.vue: grezzi+vuoti+finiti >
   tasche). (v2 1.4) era #ff000070 fisso: ora i token di errore.
   Tolto .normal { white }: units.vue lo usa solo su .img-wrapper, che ha
   un suo .img-wrapper.normal scoped piu' specifico. */
.errore{
    background-color: var(--color-danger-bg);
    color: var(--color-danger);
}

/* Card global (wizard /selectPiece, /selectGripper, ..., e altre view che
   usano .card senza scoped override). UI-5.5b refactor con design tokens.
   Dashboard (units.vue) e Conf (PartsView) hanno scoped .card che vince
   per specificity. */
.card {
    position: relative;
    overflow: hidden;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);   /* v2: era 18px fisso */
    padding: var(--space-5);
    min-height: 240px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    box-shadow: var(--elevation-2);
    transition:
        transform var(--transition-fast),
        box-shadow var(--transition-fast),
        background var(--transition-fast);
    color: var(--text-primary);
    margin: var(--space-2);
}

.card:hover {
    background: var(--bg-surface-2);
    transform: translateY(-2px);
    box-shadow: var(--elevation-3);
}

.card h4 {
    color: var(--text-primary);
    margin: var(--space-2) 0;
    text-align: center;
}

.card img {
    border-radius: 12px;
    background-color: transparent;
    padding: 0;
    margin: 0 auto var(--space-3);
    max-width: 80px;
    max-height: 80px;
    object-fit: contain;
}

/* Card opt-out (Manual Vice, NO PALLET, NO VICE, NO FIXTURE) — bg coral
   inline mantenuto come segnale semantico "opt-out". Text-primary su coral
   per leggibilita' (contrast ~3.5:1, accettabile per testo bold/large). */
.card[style*="coral"],
.card[style*="coral"] h4 {
    color: var(--text-primary);
}

/* Variant detailed: nome top-left in pill, meta block bottom-center.
   Override del centering flex del .card base (display:block + position
   absolute children). Usato da selectPiece/Pallet/Vice/Fixture wizard. */
.card.card--detailed {
    display: block;
    padding: 0;
    min-height: 240px;
}

.card--detailed .card-name {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    background: var(--bg-surface-2);
    color: var(--text-primary);
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-sm);
    z-index: 2;
    max-width: calc(100% - 2 * var(--space-3));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card--detailed .card-meta {
    position: absolute;
    bottom: var(--space-3);
    left: 0;
    right: 0;
    text-align: center;
    z-index: 2;
    padding: 0 var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.card--detailed .card-descr {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
}

.card--detailed .card-dim {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
}

.card--detailed .card-pos {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-style: italic;
    margin-top: 2px;
}

.container {
    position: relative;
    z-index: 1;
    padding: 0;
    width: 100%;
    text-align: center;
}

.container h4,
.container p {
    text-align: center;
    margin: var(--space-1) 0;
}

/*cards end*/

/* (v2 1.4) tolti: il secondo .center (doppione di quello sopra) e lo
   stile .checkbox input[type=checkbox] (interruttore rosso/verde a
   gradienti fissi): nessun template usa piu' la classe .checkbox. */

/*ELIMINO le frecce nei campi di inserimento di tipo number*/
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    
    input[type=number] {
        -moz-appearance: textfield;
    }

/* (v2 1.4) restano, di proposito: lampo lightblue alla pressione (feedback
   dei comandi, anche sulle pagine di comando: non si cambia ora) e il
   grigio #8c8b8b dei bottoni di riga senza colore di tipo (pause/modify/
   place/move/save di ComandsRows, Comand4Conf: icone PNG nere, su un fondo
   scuro a token sparirebbero). Il rosa dei comandi bloccati in testa al
   file e' uno stato. */
.button_pressed:active {
    transform: scale(0.9);
    background-color: lightblue;
}

.pure-button-group .pure-button {
    background-color: #8c8b8b;
}
</style>

<style scoped>

body {
    color: #777;
}

.pure-img-responsive {
    max-width: 6%;
    height: auto;
}

/*
Add transition to containers so they can push in and out.
*/
#layout,
#menu,
.menu-link {
    -webkit-transition: all 0.2s ease-out;
    -moz-transition: all 0.2s ease-out;
    -ms-transition: all 0.2s ease-out;
    -o-transition: all 0.2s ease-out;
    transition: all 0.2s ease-out;
}

/*
This is the parent `<div>` that contains the menu and the content area.
*/
#layout {
    position: relative;
    left: 0;
    padding-left: 0;
}
    #layout.active #menu {
        left: 150px;
        width: 150px;
    }

    #layout.active .menu-link {
        left: 150px;
    }
/*
The content `<div>` is where all your content goes.
*/
.content {
    margin: 0 auto;
    padding: 0 2em;
    max-width: 800px;
    margin-bottom: 50px;
    line-height: 1.6em;
}

.header {
     margin: 0;
     color: #333;
     text-align: center;
     padding: 2.5em 2em 0;
     border-bottom: 1px solid #eee;
 }
    .header h1 {
        margin: 0.2em 0;
        font-size: 3em;
        font-weight: 300;
    }
     .header h2 {
        font-weight: 300;
        color: #ccc;
        padding: 0;
        margin-top: 0;
    }

.content-subhead {
    margin: 50px 0 20px 0;
    font-weight: 300;
    color: #888;
}



/*
The `#menu` `<div>` is the parent `<div>` that contains the `.pure-menu` that
appears on the left side of the page.
*/
.pure-menu-type{
  margin-left:10px;
}
.pure-menu-item{
  margin-left:15px;
}


/* DE3 (sessione sidebar/modali): rimosso il blocco boilerplate PureCSS
   #menu / .menu-link (hamburger legacy) — nessun template lo usava piu',
   la navigazione e' SideBar.vue dalla UI-3. */


/* breaccrumbs */
.breadcrumb {
    background: #eee;
    border: 1px solid #c6c6c6;
    border-radius: 2px;
    color: #666;
    font: 14px/30px sans-serif;
    height: 30px;
    list-style: none;
    padding: 0;
    text-shadow: 0 1px 1px hsla(0,0%,100%,.75);
    overflow: hidden;
}
.breadcrumb li {
    float: left;
}
.breadcrumb a {
    background: #e6e6e6;
    color: #666;
    display: block;
    padding: 0 30px 0 40px;
    position: relative;
    text-decoration: none;
}
.breadcrumb li:first-child a {
    padding-left: 25px;
}
.breadcrumb li:last-child a:hover {
    background: #eee;
    cursor: text;
}
.breadcrumb li a:after {
    background: #e6e6e6;
    box-shadow: 1px -1px 0 #c6c6c6;
    content: '';
    height: 22px;
    position: absolute;
    right: -10px;
    top: 4px;
    width: 22px;
    z-index: 10;
    -webkit-transform: rotate(45deg);
       -moz-transform: rotate(45deg);
        -ms-transform: rotate(45deg);
         -o-transform: rotate(45deg);
            transform: rotate(45deg);
}
.breadcrumb a:hover,
.breadcrumb li a:hover:after {
    background: #fff0a0;
}
.breadcrumb li:last-child a:after {
    box-shadow: none;
}
.breadcrumb li:last-child a,
.breadcrumb li:last-child a:after,
.breadcrumb li:last-child a:hover:after {
    background: #eee;
}

    /*ELIMINO le frecce nei campi di inserimento di tipo number*/
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
    }

    /* speciale per Firefox */
    input[type=number] {
    -moz-appearance: textfield;
    }

</style>


