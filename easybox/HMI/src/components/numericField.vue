<script setup>
    import { dataStored } from '../data.js'
</script>

<template>
    <span>
        <button class="changeValue" @click="dec">
            <strong>-</strong>
        </button>    
        <!--input  type="text" 
                id="aligned-foo" 
                @blur="checkValue()"  
                v-model="value"  
                :name="name" 
                :readonly="dataStored.userLevel==0"
                style="text-align: center;width:230px;"
                :class="{'error':(parseFloat(value)<min||parseFloat(value)>max)}"/-->
        <input  type="number" 
                id="aligned-foo" 
                :name="name" 
                :value="modelValue"
                @input="$emit('update', $event.target.value)"
                :readonly="dataStored.userLevel==0"
                style="text-align: center;width:226px; padding: 8px 0px 8px 0px;"
                :class="{'error':(parseFloat(modelValue)<min||parseFloat(modelValue)>max)}"
                :min="min"
                :max="max" />  <!--v-model="value" -->
        <button class="changeValue" @click="inc">
            <strong>+</strong>
        </button>                    
        <span v-if="unitMeasure!=undefined">
            &nbsp;
            {{unitMeasure}} 
        </span>
        <!--span v-if="min!=undefined && max!=undefined">  
            &nbsp; [{{ min }} .. {{ max }}]
        </span-->
    </span>
</template>

<script>
  export default {
    name: "numericField",
    emits: ['update'],
    data(){ },
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
        checkValue() {
        },
        inc(){
            if (this.integerVal)
                this.$emit('update', parseInt(this.modelValue)+parseInt(this.step))
            else
                this.$emit('update', (parseFloat(this.modelValue)+parseFloat(this.step)).toFixed(3))
        },
        dec(){
            if (this.integerVal)
                this.$emit('update', parseInt(this.modelValue)-parseInt(this.step))
            else
                this.$emit('update', (parseFloat(this.modelValue)-parseFloat(this.step)).toFixed(3))
        }
    }
  };
  </script>

<style scoped>
    .changeValue{
        min-width: 2em; 
        min-height: 2em; 
        margin-left:4px;
        margin-right:4px;
        border-radius:9px; 
        margin-left:2px;
        background-color: lightsteelblue;
    }
    .error{
        background-color: #ff0000cc;
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
  