<script setup>
    import { dataStored } from '../data.js'
</script>

<template>
    <select id="aligned-foo" :name="name" :value="modelValue"  :readonly="dataStored.userLevel==0" @change="$emit('update',$event.target.value)" >
            <option :value="dataStored.status_notDef">
                {{$t('status.notDef')}} &nbsp;({{$t('Code')}} {{ dataStored.status_notDef }}) 
            </option>
            <option :value="dataStored.status_empty">
                {{$t('status.empty')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_empty }})
            </option>
            <option :value="dataStored.status_working">
                {{$t('status.working')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_working }})
            </option>
            <option :value="dataStored.status_raw">
                {{$t('status.raw')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_raw }})
            </option>
            <option :value="dataStored.status_finished">
                {{$t('status.finished')}} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;({{$t('Code')}} {{ dataStored.status_finished }} )
            </option>
    </select>
</template>

<script>
  export default {
    name: "optionStatus",
    emits: ['update'],
    data(){ },
    props: {
        name: String,
        modelValue:Number
    },    
    methods: {
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
  