<script setup>
import { ref } from "vue";
import SideBar from "./SidebarPlugin/SideBar.vue";

const isOpen = ref(true);

const toggleSidebar = () => {
  isOpen.value = !isOpen.value;
};
</script>

<template>
  <div class="layout">
    <SideBar :open="isOpen" />

    <button
      class="toggle-btn"
      :class="{ open: isOpen, closed: !isOpen }"
      @click="toggleSidebar"
      :aria-label="isOpen ? 'Collassa sidebar' : 'Espandi sidebar'"
      type="button"
    >
      <span>{{ isOpen ? "«" : "»" }}</span>
    </button>

    <main class="content" :class="{ 'content--collapsed': !isOpen }">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.content {
  flex: 1;
  padding: 80px var(--space-5) var(--space-4);  /* top 80 = 64 TopBar + 16 breathing (sotto ombra proiettata) */
  box-sizing: border-box;
  margin-left: 220px;                            /* sidebar piena (era 260) */
  transition: margin-left 0.25s ease-in-out;
}

.content--collapsed {
  margin-left: 0;                                /* sidebar invisibile (era 80) */
}

/* Toggle button: pillola fissa fra sidebar e contenuto.
   left transiziona sincronizzato con sidebar width per restare attaccata
   al bordo della sidebar durante l'animazione (entrambe 0.25s ease-in-out). */
.toggle-btn {
  position: fixed;
  top: 50vh;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  z-index: 950;                                  /* sopra sidebar (900), sotto TopBar (1000) */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  box-shadow: var(--elevation-2);
  transition:
    left 0.25s ease-in-out,
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.toggle-btn.open {
  left: 204px;                                   /* 220 sidebar - 16 = half-in half-out */
}

.toggle-btn.closed {
  left: 4px;                                     /* visibile sul bordo sx del viewport */
}

.toggle-btn:hover,
.toggle-btn:focus-visible {
  background: var(--bg-surface-2);
  border-color: var(--border-strong);
}

.toggle-btn:focus {
  outline: none;
}
</style>

<!--VECCHIO STYLE-->
<!--style scoped>
:deep(.pure-menu-link) {
    color: var(--menu-link-color);
    text-decoration: none;
    transition: color 0.3s ease;
}

:deep(.pure-menu-link:hover),
:deep(.pure-menu-link.router-link-active) {
    color: var(--menu-link-hover);
}

li img {
    width: 15px;
}

.pure-img-responsive {
    max-width: 100%;
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
    color: #000000;
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
    color: #000000;
}



/*
The `#menu` `<div>` is the parent `<div>` that contains the `.pure-menu` that
appears on the left side of the page.
*/
.pure-menu-type {
    margin-left: 10px;
}

.pure-menu-item {
    margin-left: 10px;
    font-size: large;

}


#rigaInAlto {
    height: 4em;
    top: 0px;
    left: 200px;
    background: white;
    overflow-y: auto;
    border-bottom: 2px solid;
    border-color: #071972;
}

#rigaInAlto p {
    float: right;
    padding-right: 80px;
    background-image: url('/src/assets/casco.PNG');
    background-repeat: no-repeat;
    background-size: 1.8em;
    background-position-x: 50%;
    opacity: 66%;
    /*
    border-radius: 35px;
    background-color: rgb(201, 201, 153);
    */
}

.operatorLevel {
    float: right;
    padding-right: 30px;
    padding-top: 7px;
}

#menu {
    margin-left: -150px;
    /* "#menu" width */
    width: 150px;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1000;
    /* so the menu or its navicon stays above all content */
    /*background: #071972;*/
    background: transparent;
    border-right: 2px dashed #ff8100;
    overflow-y: auto;
    color: #adbcc2;
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
    /*background: #333;*/
    background: linear-gradient(to right, #071972, #f1f5f9);

    color: black;
    /*border-left:2px dashed;
            border-color:#f1f5f9;*/
}

/*
    This styles the selected menu item `<li>`.
    */
#menu .pure-menu-selected

/*#menu .pure-menu-heading*/
    {
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
    display: block;
    /* show this only on small screens */
    top: 0;
    left: 0;
    /* "#menu width" */
    background: #000;
    background: rgba(0, 0, 0, 0.7);
    font-size: 10px;
    /* change this value to increase/decrease button size */
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
        padding-left: 150px;
        /* left col width "#menu" */
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
</style-->
