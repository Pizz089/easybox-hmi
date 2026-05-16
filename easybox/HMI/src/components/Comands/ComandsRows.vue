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
    img {
        width: 16px
    }
    
    .pure-button-disabled{
        background-color:coral;
    }

    @media (max-width: 1022px) {
        .pure-button-group .pure-button{
            border:1px solid;
            border-color:lightgray;
            /*border-radius: 14px;*/
        }
        .oneColumn{
            display:table-caption;
        }
    }
    
    @media (min-width: 1022px) {
        .pure-button:last-child {
            border-top-right-radius: 14px;
            border-bottom-right-radius: 14px;
        }
        .pure-button:first-child {
            border-top-left-radius: 14px;
            border-bottom-left-radius: 14px;
        }
    }   
    
    .pure-button-group {
        margin-top: 9px;
        min-width:105px
    }

    
</style>