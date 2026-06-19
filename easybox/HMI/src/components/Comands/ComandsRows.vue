<script setup>
    import { RouterLink, RouterView } from 'vue-router'
       
    import { dataStored } from '../../data.js';
</script>

<template>
    <span class="oneColumn">
        <div class="pure-button-group" role="group">
            <button v-if="play" class="pure-button button_pressed play" @click="$emit('cmdPlay')" :disabled="playDisable">
                <svg viewBox="0 0 24 24" fill="currentColor" class="cmd-icon">
                    <polygon points="6,4 20,12 6,20" />
                </svg>
            </button>
            <button v-if="pause" class="pure-button button_pressed" @click="$emit('cmdPause')" :disabled="pauseDisable">
                <img src="../../assets/pause.png" style="width:20px">
            </button>
            <button v-if="stop" class="pure-button button_pressed stop" @click="$emit('cmdStop')" :disabled="stopDisable">
                <svg viewBox="0 0 24 24" fill="currentColor" class="cmd-icon">
                    <rect x="6" y="6" width="12" height="12" />
                </svg>
            </button>
            <button v-if="modify" class="pure-button button_pressed" @click="modifyItem()" :id="lockedLevelOP" :disabled="modifyDisable">
                <img src="../../assets/modification.png" style="width:20px">
            </button>
            <button v-if="place" class="pure-button button_pressed" @click="$emit('cmdPlace')" :disabled="placeDisable">
                <img src="../../assets/target_black.png" style="width:20px">
            </button>
            <button v-if="del" class="pure-button button_pressed del"  @click="deleteItem()" :id="lockedLevelOP" :disabled="delDisable">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="cmd-icon">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
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
/* ============ ONECOLUMN WRAPPER ============ */
/* Span wrapper diventa flex container con right-align per spostare il
   button-group a destra del td (in produzione table = colonna ultima). */
.oneColumn {
    display: flex;
    justify-content: flex-end;
}


/* ============ BUTTON GROUP ============ */
/* inline-flex per rispettare vertical-align:middle del td parent. */
.pure-button-group {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
}


/* ============ BUTTONS (48x48 touch target HMI) ============ */
.pure-button-group .pure-button {
    width: 48px;
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: filter var(--transition-fast);
    color: var(--text-primary);
}

.cmd-icon {
    width: 22px;
    height: 22px;
}

/* Hover/focus brightness uniforme su bg + icona. */
.pure-button-group .pure-button:hover:not(:disabled),
.pure-button-group .pure-button:focus-visible:not(:disabled) {
    filter: brightness(0.92);
    outline: none;
}

/* Pressed: scale tactile feedback. */
.pure-button-group .pure-button.button_pressed:active {
    transform: scale(0.95);
}


/* ============ DISABLED ============ */
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


/* ============ PALETTE PER-TYPE (class-based, SVG via currentColor) ============ */

/* play -> verde saturato, icona nera (contrasto su verde brillante) */
.pure-button-group .pure-button.play {
    background: var(--color-success);
    color: var(--bg-base);
}

/* stop -> bianco, icona nera */
.pure-button-group .pure-button.stop {
    background: var(--text-primary);
    color: var(--bg-base);
}

/* del -> rosso saturato, icona bianca */
.pure-button-group .pure-button.del {
    background: var(--color-danger);
    color: var(--text-primary);
}


/* ============ MEDIA / MISC ============ */
@media (max-width: 1022px) {
    .oneColumn {
        display: table-caption;
    }
}

/* PNG icons (pause/modify/place/move/save) — out of UI-5 scope, keep size fallback */
img {
    width: 16px;
}
</style>