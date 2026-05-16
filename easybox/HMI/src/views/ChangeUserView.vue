<script setup>
    import { dataStored } from '../data.js'
</script>

<template>
    <div class="pure-u-1">
        <div class="pure-u-1-3"></div>
        <div class="pure-u-1-3"  > <!--@click="dataStored.chgUserLevel"-->
        
            <h1>Password required</h1>

            <!--form class="pure-form" action="testtesttest" method="POST" name="userPassword" -->
            <div class="pure-form">
                <input type="password" placeholder="Password here..." required="yes" v-model="password" v-on:keyup.enter="checkLevel()"/>
                <button  class="pure-button-primary" @click="checkLevel()">Send</button>
                <p>{{ resp }}</p>
            </div>
            
        </div>
    </div>
</template>

<script>
    export default {
        data(){
            return {
                password:"",
                resp:""
            }
        },
        methods: {
            checkLevel() {
                switch (this.password){
                    case "333":
                        dataStored.userLevel=1;
                        sessionStorage.setItem("userLevel", dataStored.userLevel);
                        console.log("user 1")
                        setTimeout(() => {
                            dataStored.userLevel=0;
                            sessionStorage.removeItem("userLevel");
                            alert("User changed to OPERATOR!");
                            },
                            dataStored.timeoutUserLevel
                            );
                        this.resp='User level changed: MAINTENANCE';
                        break;
                
                    case "555":
                        dataStored.userLevel=2;
                        sessionStorage.setItem("userLevel", dataStored.userLevel);
                        console.log("user 2"),
                        setTimeout(() => {
                            dataStored.userLevel=0;
                            sessionStorage.removeItem("userLevel");
                            alert("User changed to OPERATOR!");
                            },
                            dataStored.timeoutUserLevel);
                        this.resp='User level changed: ADMIN';
                        break;
                    
                    case "666":
                        dataStored.userLevel=2;
                        sessionStorage.setItem("userLevel", dataStored.userLevel);
                        console.log("user 2"),
                        this.resp='User level changed: ADMIN';
                        break;
                        
                    
                    default:
                        dataStored.userLevel=0;
                        sessionStorage.removeItem("userLevel");
                        this.resp='Password error...';
                        break;
                    
                }
                
            }
        }
    }
</script>

<style>
    button{
        margin-left: 8px;
        padding: 6px;
    }
</style>

