<template>
    <!--div class="alert" :class="type" @click="$emit('cmd_close')" >
        <span class="closebtn" ><strong>&times;</strong></span> 
        <h3>{{title}}</h3> 
        <hr>
        <br>
        <strong>{{desc}}</strong> 
        <br><br>
        <ul>
            <li v-for="chk in checks" :key="chk">{{ chk }}</li>
        </ul>
        <slot/>
    </div-->
    <div class="alert" :class="type"> <!--@click="$emit('cmd_close')"-->
        <span @click="$emit('cmd_close')" class="pure-u-1">
            <h3>{{ $t(title) }}</h3>
            <hr>
        </span>
        <br>
        <strong>{{ $t(desc) }}</strong>
        <br><br>
        <ul>
            <li v-for="chk in checks" :key="chk">{{ chk }}</li>
        </ul>
        <slot />

        <div class="close-container" @click.stop>
            <button class="close-button" @click="$emit('cmd_close')">
                <img src="@/assets/xRossa2.png" alt="Chiudi" class="close-icon" />
            </button>
        </div>
    </div>
</template>

<script>
import { dataStored } from '@/data';

export default {
    emits: ['cmd_close'],
    props: {
        title: String,
        desc: String,
        type: '',
        checks: []
    }
};
</script>

<style scoped>
.alert {
  position: fixed;             
  top: 50%;                    
  left: 50%;                   
  transform: translate(-50%, -50%);  
  padding: 20px 10px 400px; 
  background-color: coral;
  color: white;
  border-radius: 15px;
  transition: all 0.5s ease-out; 
  height: auto;                  
  max-height: 80vh;              
  width: 90%;
  max-width: 1000px;
  z-index: 50000;
  opacity: 1;
  overflow-y: auto;              
}



/* vecchio CSS
.close-button {
  background: white;
  color: coral;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.3s ease;
}*/

.close-button {
  all: unset;               
  position: absolute;  
  top: 20px;            
  right: 10px;           
  cursor: pointer;
  display: flex;            
  align-items: center;
  justify-content: center;
  border: 2px solid black;  
  border-radius: 9px;
  padding: 0;
  background-color: black;              
}

.close-icon {
  width: 30px;              
  height: 30px;
  display: block;
}

.alarm {
    background-color: red;
    opacity: 90%;
    border: dotted 3px white;
}

.warning {
    background-color: #ffff22fa;
    /*#f1f109fa;*/
    opacity: 96%;
    color: black;
}

.message {
    background-color: #546f54fa;
    /*#036f03e6;*/
    opacity: 100%;
}

.closebtn {
    margin-left: 15px;
    margin-top: 10px;
    /*color: white;*/
    font-weight: bold;
    float: right;
    line-height: 20px;
    cursor: pointer;
    transition: all 3s ease-out;
    font-size: 80px;
    font-family: cursive;
}

.closebtn:hover {
    color: green
}
</style>