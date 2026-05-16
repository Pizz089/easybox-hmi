<template>

    <div id="popup1" class="overlay">
    	<div class="popup">
    		<h2>{{$t(this.title)}}</h2>
    		<a class="close" href="#">&times;</a>
    		<div class="content">
    			<h4><slot></slot></h4>
    		</div>
            <br>
            <br>
            <div > 
                <button class="pure-button button-error pure-u-1" @click="$emit('comando1')">{{ comando1 }}</button>
            </div>
            <br>
            <div v-if="comando2"> 
                <button class="pure-button button-error pure-u-1" @click="$emit('comando2')">{{ comando2 }}</button>
            </div>
    	</div>
    </div>
</template>
<script>
export default {
    emits:[ 'comando1', 'comando2'],
    props: {
        title: {
            type: String,
            default: "",
        },
        comando1: {
            type: String,
            default: "",
        },
        comando2: {
            type: String,
            default: "",
        }
    }
}
</script>

<style scoped>
    .button-error {
        background: rgb(202, 60, 60);
        color: white;
        border-radius: 4px;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
    }

    h1 {
    text-align: center;
    font-family: Tahoma, Arial, sans-serif;
    color: #06D85F;
    margin: 80px 0;
    }

    .box {
    width: 40%;
    margin: 0 auto;
    background: rgba(255,255,255,0.2);
    padding: 35px;
    border: 2px solid #fff;
    border-radius: 20px/50px;
    background-clip: padding-box;
    text-align: center;
    }

    .button {
    font-size: 1em;
    padding: 10px;
    color: #fff;
    border: 2px solid #06D85F;
    border-radius: 20px/50px;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.3s ease-out;
    }
    .button:hover {
    background: #06D85F;
    }

    .overlay {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    transition: opacity 500ms;
    visibility: hidden;
    opacity: 0;
    }
    .overlay:target {
    visibility: visible;
    opacity: 1;
    }

    .popup {
    margin: 70px auto;
    padding: 20px;
    background: #fff;
    border-radius: 5px;
    width: 30%;
    position: relative;
    transition: all 5s ease-in-out;
    }

    .popup h2 {
    margin-top: 0;
    color: #333;
    font-family: Tahoma, Arial, sans-serif;
    }
    .popup .close {
    position: absolute;
    top: 20px;
    right: 30px;
    transition: all 200ms;
    font-size: 30px;
    font-weight: bold;
    text-decoration: none;
    color: #333;
    }
    .popup .close:hover {
    color: #06D85F;
    }
    .popup .content {
    max-height: 30%;
    overflow: auto;
    }

    @media screen and (max-width: 700px){
    .box{
        width: 70%;
    }
    .popup{
        width: 70%;
    }
    }
</style>