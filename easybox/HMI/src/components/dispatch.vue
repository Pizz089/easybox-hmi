<!-- DISPATCH/<unit>/<numeroDispatch> -->
<script setup>
    import { dataStored } from '../data.js'
</script>

<template>
    <div class="pure-u-1">
        <h2>Dispatcher</h2>
        <div class="pure-u-1-3">
            <div style="margin-left:20px;">
                <h3>Robot</h3> 
                <table >
                    <tr v-for="(r,index) in robot" :key="r">
                        <td>{{$t('dispatch.robot.'+index)}} </td>
                        <td> 
                            <span style="border:solid 2px lightblue; border-radius: 15px;margin:5px;text-align: left;padding-left:2em;padding-right:2em">
                                {{ r }}
                                <!--span style="margin-left:2em;"> 
                                    {{$t('robot.dispatch.'+index+'.'+r)}}
                                </span-->
                            </span> 
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="pure-u-1-3">
            <h3>MC1</h3> 
            <table>
                <tr v-for="(m,index) in mc1" :key="m">
                    <td>{{$t('dispatch.mc.'+index)}}</td>
                    <td> 
                        <span style="border:solid 2px lightblue; border-radius: 15px;margin:5px;text-align: left; ;padding-left:2em;padding-right:2em">
                            {{ m }}
                        </span> 
                    </td>
                </tr>
            </table>

            <br>

            <h3>MC2</h3> 
            <table>
                <tr v-for="(m,index) in mc2" :key="m">
                    <td>{{$t('dispatch.mc.'+index)}}</td>
                    <td> 
                        <span style="border:solid 2px lightblue; border-radius: 15px;margin:5px;text-align: left;;padding-left:2em;padding-right:2em">
                            {{ m }}
                        </span> 
                    </td>
                </tr>
            </table>
        </div>

        <div class="pure-u-1-3">
            <h3>Box</h3> 
            <table>
                <tr v-for="(b,index) in box" :key="b">
                    <td>{{$t('dispatch.box.'+index)}}</td>
                    <td> 
                        <span style="border:solid 2px lightblue; border-radius: 15px;margin:5px;text-align: left;;padding-left:2em;padding-right:2em">
                            {{ b }}
                        </span> 
                    </td>
                </tr>
            </table>
        </div>
        <br><br>
    </div>

  </template>

  <script>
    export default {
        data() {
            return { 
                robot:[0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
                mc1:  [0,0,0,0,0, 0,0,0,0,0],
                mc2:  [0,0,0,0,0, 0,0,0,0,0],
                box:  [0,0,0,0,0, 0,0,0,0,0]
            }
        },
        methods: { },
        mounted(){
            dataStored.WS.socket.on("DISPATCH", payload =>{
                switch (payload.unit){
                    case "ROBOT":
                        this.robot[payload.dispatch] = payload.value;
                        break;
                    case "MC1":
                        this.mc1[payload.dispatch] = payload.value;
                        break;
                    case "MC2":
                        this.mc2[payload.dispatch] = payload.value;
                        break;
                    case "BOX":
                        this.box[payload.dispatch] = payload.value;
                        break;
                }
            });
        },
        unmounted(){
            //dataStored.WS.socket.off('DISPATCH');
        }
    }
  </script>

<style scoped> 
</style>