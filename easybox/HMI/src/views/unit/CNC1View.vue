<script setup>
    import { dataStored } from '../../data.js'
</script>

<template>
  <div class="pure-u-1">
    
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1>{{$t('Stato')}} {{ $t('MC1') }}</h1>
      <div class="area pure-u-1">          
          <h5 v-if="dataFixture.ID>0"> {{$t('Fixture')}} ID: {{ dataFixture.ID }} </h5>
          <h5 v-if="dataFixture.ID>0"> 
            {{ dataFixture.FAMILY }} 
            {{ (dataFixture.DESCR.trim().length)? ' - '+dataFixture.DESCR:'' }}  
          </h5>
          <h5 v-if="dataFixture.ID>0"> Status: {{ dataFixture.STATUS_DESC }}</h5>
          <h5 v-if="!dataFixture.ID>0"> NO FIXTURE MOUNTED! </h5>
      </div>

    </div>
    <div class="pure-u-1-24">
    </div>
    <div class="pure-u-10-24">
      <h1> {{$t('Comandi')}} </h1>
      
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
                style="margin-top:10px; padding:10px" @click="sendToPLC(30)"> 
                {{ $t('APRI_PORTA')}}
        </button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
              style="margin-top:10px; padding:10px" @click="sendToPLC(31)">
              {{ $t('CHIUDI_PORTA')}}
        </button>
      </div>  
      
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
                style="margin-top:10px; padding:10px" @click="sendToPLC(20)"> 
                SBLOCCO PALLET
        </button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
              style="margin-top:10px; padding:10px" @click="sendToPLC(21)">
              BLOCCO PALLET
        </button>
      </div> 

      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
                style="margin-top:10px; padding:10px" @click="sendToPLC(10)"> 
                SBLOCCO MORSA
        </button>
      </div>
      <div class="pure-u-1-2">
        <button class="pure-button-micromission pure-u-1 button_pressed"  
              style="margin-top:10px; padding:10px" @click="sendToPLC(11)">
              BLOCCO MORSA
        </button>
      </div> 
      
    </div>
  </div>
</template>

<script>
export default {
    data(){
        return {
          dataFixture:{},
            polling:true
        }
    },
    methods: {
      sendToPLC(val) {
        dataStored.WS.socket.emit("TO_PLANT/CMD/MC1", val);
      },
        getGripperData() {
            fetch(dataStored.server+'api/conf/fixture/showOnMC/1',{ method: 'GET'})
              .then(response => {
                  if (!response.ok) {
                      throw new Error('Network response was not ok');
                  }
                  return response.json()
              })
              .then(fx => {
                  if (JSON.stringify(fx)==JSON.stringify([]))
                    this.dataFixture = {}
                  else
                    this.dataFixture = fx[0];
              })
              .catch(error => {
                  console.info("-------------")
                  console.info(error);
              });
        },
    },
    mounted(){
        this.getGripperData()
        setInterval(() => {
            if(this.polling)
                this.getGripperData()
        }, 3000);
    },
    unmounted(){
        this.polling=false;
    }
  }
</script>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
.pure-button-micromission{
  background-color: rgb(33, 33, 211);
  color: whitesmoke;
}
.pure-button-mission{
  background-color: orange;
}
.area {
  color: black;
  background-color: lightgray;
  padding: 5px;
  margin-top: 10px;
  text-align: center;
}
</style>

