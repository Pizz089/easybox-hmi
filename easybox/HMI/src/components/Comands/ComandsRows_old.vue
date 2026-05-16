<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import popup from '../../components/popup.vue';
        
    import { dataStored } from '../../data.js';
</script>

<template>
    <popup title="sure" comando1="Elimina Pinza" @comando1="deleteGripper()" >
        {{ $t('gripper.delete') }} 
    </popup>
    <div class="pure-button-group" role="group">
        <button v-if="play" class="pure-button">
            <img src="../../assets/play.png">
        </button>
        <button v-if="pause" class="pure-button">
            <img src="../../assets/pause.png">
        </button>
        <button v-if="stop" class="pure-button">
            <img src="../../assets/stop.png">
        </button>
        <button v-if="modify" class="pure-button">
            <a class="button" @click="selectGripper()">
                <img src="../../assets/chiaveIng.svg" width="14px">
            </a>
        </button>
        <button v-if="del" class="pure-button">
            <a class="button" href="#popup1" >
                <img src="../../assets/cestino.png" width="14px">
            </a>
        </button>
    </div>
    <h3>
        <slot />
    </h3>
</template>

<script>
    export default {
        props: {
            reference: {
                type: String,
                default: "",
            },
            play: {
                type: String,
                default: "",
            },
            pause: {
                type: String,
                default: "",
            },
            stop: {
                type: String,
                default: "",
            },
            modify: {
                type: String,
                default: "",
            },
            del: {
                type: String,
                default: "",
            },
            index:{
                type: Number,
                default: 0,
            }
        },
        methods: {
            selectGripper(){
                let stringObj = new String(this.index);
                //dataStored.gripperID=stringObj;
                this.$router.push({ path: this.reference, query:{gripperID: stringObj}} )
            },
            deleteGripper(){
                alert("index: "+this.index)
                fetch(dataStored.server+'api/conf/gripper/'+this.index,{ method: 'delete'})
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json()
                    })
                    .catch(error => {
                        console.info(error);
                    });
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

    @media (max-width: 820px) {
        .pure-button-group .pure-button{
            border:0px;
        }
    }
    
    @media (min-width: 820px) {
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
    }
</style>