<script setup>
    import { RouterLink, RouterView } from 'vue-router'
       
    import { dataStored } from '../../data.js';
</script>

<template>
    <span class="oneColumn">
        <div class="pure-button-group" role="group">
            <button v-if="play" class="pure-button button_pressed" @click="$emit('cmdPlay')" :disabled="playDisable">
                <img src="../../assets/play.png" style="width:20px">
            </button>
            <button v-if="pause" class="pure-button button_pressed" @click="$emit('cmdPause')" :disabled="pauseDisable">
                <img src="../../assets/pause.png" style="width:20px">
            </button>
            <button v-if="stop" class="pure-button button_pressed" @click="$emit('cmdStop')" :disabled="stopDisable">
                <img src="../../assets/stop.png" style="width:20px">
            </button>
            <button v-if="modify" class="pure-button button_pressed" @click="modifyItem()" :id="lockedLevelOP" :disabled="modifyDisable">
                <img src="../../assets/modification.png" style="width:20px">
            </button>
            <button v-if="place" class="pure-button button_pressed" @click="$emit('cmdPlace')" :disabled="placeDisable">
                <img src="../../assets/target_black.png" style="width:20px">
            </button>
            <button v-if="del" class="pure-button button_pressed"  @click="deleteItem()" :id="lockedLevelOP" :disabled="delDisable">
                <img src="../../assets/cestino.png" style="width:20px">
            </button>
            <button v-if="move" class="pure-button button_pressed" @click="extract()" :id="lockedNotLocal" :disabled="moveDisable">
                <img src="../../assets/hook.png"  style="width:20px">
            </button>
            <button v-if="save" class="pure-button button_pressed" @click="$emit('cmdSave')" :disabled="saveDisable">
                <img src="../../assets/disk.png"  style="width:20px">
            </button>
        </div>
    </span>
    <h3>
        <slot />
    </h3>
</template>

<script>
    export default {
        emits:[ 'cmdPlay', 'cmdPause', 'cmdStop', 'cmdModify', 'cmdDel', 'cmdMove', 'cmdPlace', 'cmdSave'],
        props: {
            index:{
                type: Number,
                default: 0,
            },
            reference: {
                type: String,
                default: "",
            },
            play: {
                type: [Boolean,String],
                default: false,
            },
            playDisable: {
                type: [Boolean,String],
                default: false,
            },
            pause: {
                type: [Boolean,String],
                default: false,
            },
            pauseDisable: {
                type: [Boolean,String],
                default: false,
            },
            stop: {
                type: [Boolean,String],
                default: false,
            },
            stopDisable: {
                type: [Boolean,String],
                default: false,
            },
            modify: {
                type: [Boolean,String],
                default: false,
            },
            modifyDisable: {
                type: [Boolean],
                default: false,
            },
            del: {
                type: [Boolean,String],
                default: false,
            },
            delDisable: {
                type: [Boolean],
                default: false,
            },
            move:{
                type: [Boolean,String],
                default: false,
            },
            moveDisable: {
                type: [Boolean],
                default: false,
            },
            place:{
                type: [Boolean,String],
                default: false,
            },
            placeDisable:{
                type: [Boolean,String],
                default: false,
            },
            save:{
                type: [Boolean,String],
                default: false,
            },
            saveDisable:{
                type: [Boolean,String],
                default: false,
            },
            showPopUp:false
        },
        methods:{
            deleteItem(){
                if (dataStored.userLevel>0) 
                    this.$emit('cmdDel')
                else{
                    //alert(this.$t("user_not_enabled"))
                    dataStored.alert.title = this.$t("WARNING");
                    dataStored.alert.desc = this.$t("user_not_enabled")
                    dataStored.alert.type = "alarm"
                }
            },
            modifyItem(){
                if (dataStored.userLevel>0) 
                    this.$emit('cmdModify')
                else{
                    //alert(this.$t("user_not_enabled"))
                    dataStored.alert.title = this.$t("WARNING");
                    dataStored.alert.desc = this.$t("user_not_enabled")
                    dataStored.alert.type = "alarm"
                }
            },
            extract(){
                if (dataStored.EasyBox){
                    if (dataStored.RobotInLocalMode)
                        this.$emit('cmdMove')
                    else{
                        dataStored.alert.title = this.$t("WARNING");
                        dataStored.alert.desc = this.$t("LocalModeReq")
                        dataStored.alert.type = "warning"
                    }
                }
                if (dataStored.RoboBox){

                }
            }
        },
        computed:{
            lockedLevelOP(){
                if (dataStored.userLevel<=0)
                    return "cmdLocked4OP"
            },
            lockedNotLocal(){
                if (!dataStored.RobotInLocalMode) 
					return 'lockedNotLocal'
				else
					return '';
            }
        }
    }
</script>


<style scoped>
/* ============ BASE BUTTON ============ */
/* Override del global App.vue (.pure-button-group .pure-button { bg: #8c8b8b })
   con token. Specificity scoped 0,3,0 batte App.vue 0,2,0. */

.pure-button-group .pure-button {
    background: var(--bg-surface-2);
    color: var(--text-primary);
    border: 0;
    transition:
        background var(--transition-fast),
        color var(--transition-fast),
        border-color var(--transition-fast);
}

.pure-button-group .pure-button:hover {
    background: var(--border-subtle);
}

/* Pressed: override App.vue `.button_pressed:active { bg: lightblue }` */
.pure-button-group .pure-button.button_pressed:active {
    transform: scale(0.95);
    background: var(--accent-active) !important;
}


/* ============ DISABLED ============ */
/* Originale `.pure-button-disabled { bg: coral }` (orrido).
   Coprire entrambi i selettori (HTML attr + class). */

.pure-button[disabled],
.pure-button[disabled]:hover,
.pure-button[disabled]:active,
.pure-button-disabled,
.pure-button-disabled:hover,
.pure-button-disabled:active {
    background: var(--bg-input) !important;
    color: var(--text-disabled) !important;
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
}


/* ============ CATEGORY-SPECIFIC TINT ============ */
/* Identificazione categoria via :has(img[src*="..."]) sui PNG icona.
   stop, pause, modify, place, move, save: restano BASE (neutral). */

/* play (avvia ordine) -> success */
.pure-button-group .pure-button:has(img[src*="play"]) {
    background: var(--color-success-bg);
}
.pure-button-group .pure-button:has(img[src*="play"]):hover {
    background: var(--color-success);
}

/* cestino (elimina ordine) -> danger */
.pure-button-group .pure-button:has(img[src*="cestino"]) {
    background: var(--color-danger-bg);
}
.pure-button-group .pure-button:has(img[src*="cestino"]):hover {
    background: var(--color-danger);
}


/* ============ BORDER RADIUS (gruppo bottoni) ============ */

@media (min-width: 1022px) {
    .pure-button:first-child {
        border-top-left-radius: var(--radius-md);
        border-bottom-left-radius: var(--radius-md);
    }
    .pure-button:last-child {
        border-top-right-radius: var(--radius-md);
        border-bottom-right-radius: var(--radius-md);
    }
}

@media (max-width: 1022px) {
    .oneColumn {
        display: table-caption;
    }
}


/* ============ MISC ============ */

.pure-button-group {
    margin-top: var(--space-2);
    min-width: 105px;
}

img {
    width: 16px;
}
</style>