<script setup>
</script>

<template>
    <span>
    <button @click="onChange(0)">0</button>
    <button @click="onChange(1)">1</button>
    <button @click="onChange(2)">2</button>
    <button @click="onChange(3)">3</button>
    <button @click="onChange(4)">4</button>
    <button @click="onChange(5)">5</button>
    <button @click="onChange('.')">.</button>
</span>
</template>

<script>
  export default {
    name: "keyboard",
    data(){
        return{
            value:0
        }
    },
    props: {
        input:0
    },
    methods: {
        onChange(i){
            //this.value=this.value*10+i
            this.$emit('onChange',i)

        }
    },
    mounted(){
        this.value = this.input
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
</style>
  