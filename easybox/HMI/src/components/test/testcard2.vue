<script setup>
    defineProps(['title','value','type'])
</script>

<template>
    
    <h3>{{type}} {{title}} => {{value}}</h3>

    
    <div class="icon-big text-center"
        :class="`icon-${{type}}`">
    </div>
    
    <div class="numbers" >
        <p>{{ title }}</p>
        <p>{{ value }}</p>
    </div>
</template>

<script>
import Card from "../Cards/Card.vue";

export default {
  name: "stats-card",
  components: {
    Card,
  },
};
</script>

