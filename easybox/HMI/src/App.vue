<script setup>
import { RouterLink, RouterView } from 'vue-router'
import Card from './components/Cards/Card.vue'
import stats_card from './components/Cards/StatsCard.vue'
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
        components: {
        stats_card,
        Card
        },
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
    #locked4OP{
        background-image:url('/src/assets/chiaveIng.svg');
        background-repeat: no-repeat;
        background-size: 1.5em;
        background-position-x: 100%;
        background-position-y: 100%;
        /*background-color:rgb(146, 115, 115);*/
        /*border: 1px dotted;*/
    } 
    #cmdLocked4OP{
        background-image:url('/src/assets/laurea.png');
        background-repeat: no-repeat;
        background-size: 1.1em;
        background-position-x: 95%;
        background-position-y: 110%;
        background-color:rgb(232, 200, 200);
        /*border: 1px dotted;*/
        
    }
    
    #locked4maintenance{
        background-image:url('/src/assets/laurea.png');
        background-repeat: no-repeat;
        background-size: 1.5em;
        background-position-x: 100%;
        background-position-y: 150%;
        /*background-color:rgb(146, 115, 115);*/
        /*border: 1px dotted;*/
        
    } 
    #lockedNotLocal{
        background-image:url('/src/assets/manuale_noBordo.png');
        background-repeat: no-repeat;
        background-size: 1em;
        background-position-x: 86%;
        background-position-y: 94%;
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

  body{
    /*background-color: rgb(241 245 249);*/
    background-color: white;
  }

  .pure-table td {
    background-color: transparent;
  }
  .pure-table-odd td {
    background-color: transparent;
  }

  .link{
    background-image:url('/src/assets/link.png');
    background-repeat: no-repeat;
    background-size: 2em;
    background-position-x: 98%;
    background-position-y: 95%;
  }   

  /* CARDS */
.errore{
    background-color:#ff000070;
}
.normal{
    background-color: white;
}

/* Card global (wizard /selectPiece, /selectGripper, ..., e altre view che
   usano .card senza scoped override). UI-5.5b refactor con design tokens.
   Dashboard (units.vue) e Conf (PartsView) hanno scoped .card che vince
   per specificity. */
.card {
    background: var(--bg-surface);
    border-radius: 18px;
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

.container {
    padding: 0;
    width: 100%;
    text-align: center;
}

.container h4,
.container p {
    text-align: center;
    margin: var(--space-1) 0;
}

.center {
  justify-content: center;
}
/*cards end*/

/* checkbox */
.checkbox input[type="checkbox"] {
    background-image: -webkit-linear-gradient(hsla(0,0%,0%,.1), hsla(0,0%,100%,.1)),
                      -webkit-linear-gradient(left, #f66 50%, rgb(106, 162, 108) 50%);

    background-size: 100% 100%, 200% 100%;
    background-position: 0 0, 15px 0;
    border-radius: 25px;
    box-shadow: inset 0 1px 4px hsla(0,0%,0%,.5),
                inset 0 0 10px hsla(0,0%,0%,.5),
                0 0 0 1px hsla(0,0%,0%,.1),
                0 -1px 2px 2px hsla(0,0%,0%,.25),
                0 2px 2px 2px hsla(0,0%,100%,.75);
    cursor: pointer;
    height: 25px;
    padding-right: 25px;
    width: 75px;
    -webkit-appearance: none;
    -webkit-transition: .25s;
}

.checkbox input[type="checkbox"]:after {
    background-color: #eee;
    background-image: -webkit-linear-gradient(hsla(0,0%,100%,.1), hsla(0,0%,0%,.1));
    border-radius: 25px;
    box-shadow: inset 0 1px 1px 1px hsla(0,0%,100%,1),
                inset 0 -1px 1px 1px hsla(0,0%,0%,.25),
                0 1px 3px 1px hsla(0,0%,0%,.5),
                0 0 2px hsla(0,0%,0%,.25);
    content: '';
    display: block;
    height: 25px;
    width: 50px;
}
.checkbox input[type="checkbox"]:checked {
    background-position: 0 0, 35px 0;
    padding-left: 25px;
    padding-right: 0;
}
/* checkbox end*/

/*ELIMINO le frecce nei campi di inserimento di tipo number*/
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    
    input[type=number] {
        -moz-appearance: textfield;
    }

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


#menu {
    margin-left: -150px; /* "#menu" width */
    width: 150px;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1000; /* so the menu or its navicon stays above all content */
    /*background: #071972;*/
    background: blue !important;
    border-right: 2px solid blue; 
    overflow-y: auto;
    color:#adbcc2;
}

    /*
    All anchors inside the menu should be styled like this.
    */ 
    #menu a {
        color: #bfb0b0;
        border: none;
        padding: 0.6em 0 0.6em 0.6em;
       
    }

    /*
    Remove all background/borders, since we are applying them to #menu.
    */
     #menu .pure-menu,
     #menu .pure-menu ul {
        border: none;
        background: transparent;
    }

    /*
    Add that light border to separate items into groups.
    */
    /*
    #menu .pure-menu ul,
    #menu .pure-menu .menu-item-divided {
        border-top: 1px solid #333;
    }*/
    
        /*
        Change color of the anchor links on hover/focus.
        */
        #menu .pure-menu li a:hover,
        #menu .pure-menu li a:focus {
            background: #333;
        }

    /*
    This styles the selected menu item `<li>`.
    */
    #menu .pure-menu-selected
    /*#menu .pure-menu-heading*/ {
        background: #1f8dd6;
    }
        /*
        This styles a link within a selected menu item `<li>`.
        */
        #menu .pure-menu-selected a {
            color: #fff;
        }

    /*
    This styles the menu heading.
    */
    #menu .pure-menu-heading {
        font-size: 110%;
        color: #fff;
        margin: 0;
        padding-bottom: 30px;
    }

/* -- Dynamic Button For Responsive Menu -------------------------------------*/

/*
The button to open/close the Menu is custom-made and not part of Pure. Here's
how it works:
*/

/*
`.menu-link` represents the responsive menu toggle that shows/hides on
small screens.
*/
.menu-link {
    position: fixed;
    display: block; /* show this only on small screens */
    top: 0;
    left: 0; /* "#menu width" */
    background: #000;
    background: rgba(0,0,0,0.7);
    font-size: 10px; /* change this value to increase/decrease button size */
    z-index: 10;
    width: 2em;
    height: auto;
    padding: 2.1em 1.6em;
}

    .menu-link:hover,
    .menu-link:focus {
        background: #000;
    }

    .menu-link span {
        position: relative;
        display: block;
    }

    .menu-link span,
    .menu-link span:before,
    .menu-link span:after {
        background-color: #fff;
        pointer-events: none;
        width: 100%;
        height: 0.2em;
    }

        .menu-link span:before,
        .menu-link span:after {
            position: absolute;
            margin-top: -0.6em;
            content: " ";
        }

        .menu-link span:after {
            margin-top: 0.6em;
        }


/* -- Responsive Styles (Media Queries) ------------------------------------- */

/*
Hides the menu at `48em`, but modify this based on your app's needs.
*/
@media (min-width: 48em) {

    .header,
    .content {
        padding-left: 2em;
        padding-right: 2em;
    }

    #layout {
        padding-left: 150px; /* left col width "#menu" */
        left: 0;
    }
    #menu {
        left: 150px;
    }

    .menu-link {
        position: fixed; 
        left: 150px;
        display: none;
    }

    #layout.active .menu-link {
        left: 150px;
    }
}

@media (max-width: 48em) {
    /* Only apply this when the window is small. Otherwise, the following
    case results in extra padding on the left:
        * Make the window small.
        * Tap the menu to trigger the active state.
        * Make the window large again.
    */
    #layout.active {
        position: relative;
        left: 150px;
    }
}


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


