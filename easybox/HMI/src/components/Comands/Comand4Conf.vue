<template>
    <div class="pure-button-group" role="group">
        <button class="pure-button">
            <img src="../../assets/chiaveIng.svg" width="14px">
        </button>
        <button class="pure-button">
            <img src="../../assets/cestino.png" width="14px">
        </button>
    </div>
</template>

<style scoped>
    img {
        width: 16px
    }

    
    .pure-button:last-child {
        border-top-right-radius: 14px;
        border-bottom-right-radius: 14px;
    }
    .pure-button:first-child {
        border-top-left-radius: 14px;
        border-bottom-left-radius: 14px;
    }

</style>