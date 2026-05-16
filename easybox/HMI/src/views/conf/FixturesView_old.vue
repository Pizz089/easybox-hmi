<script setup>
    //import orderCMD from '../components/OrderComands.vue'
    import { RouterLink, RouterView } from 'vue-router'
    import orderCMD from '../../components/Comands/ComandsRows.vue';

    import { ref, onMounted } from 'vue'
    import axios from 'axios'
    const el = ref()
    

    //onMounted( () => {
    //    fetch('http://127.0.0.1:8080/api/HMI/test',{ method: 'GET'})
    //        .then(response => {
    //            if (!response.ok) {
    //                throw new Error('Network response was not ok');
    //            }
    //            return response.json()
    //        })
    //        .then(order => {
    //            console.log(JSON.stringify(order,null,4))
    //            console.log("quanti:"+order.length)  
    //            
    //        })
    //        .catch(error => {
    //            console.info("-------------")
    //            console.info(error);
    //        });
    //    
    //    //axios.get('http://localhost:8080/api/HMI/test',{port:8080})
    //    //    .then(response => {
    //    //        console.log("qua")
    //    //        console.log(JSON.stringify(response.data,null,4));
    //    //    })
    //    //    .catch(error => {
    //    //        console.error(error);
    //    //    });
//
 //   })

</script>

<template>   
      <div class="pure-u-1-24">
          &nbsp;
      </div>

      <div class="pure-u-23-24">
           
        <h3>{{$t('fixture.welcome')}}
          <button class="pure-button pure-button-primary">{{$t('fixture.add_Fixture')}}</button>
        </h3>
        <table class="pure-table pure-table-horizontal" style="margin-top: 30px;">
            <thead>
                <tr>
                    <th>{{$t('fixture.name')}}</th>
                    <th>{{$t('fixture.lengthX')}}</th>
                    <th>{{$t('fixture.lengthY')}}</th>
                    <th>{{$t('fixture.lengthZ')}}</th>
                    <th>{{$t('fixture.position')}}</th>
                    <th>{{$t('fixture.comands')}}</th>
                </tr>
            </thead>
            <tbody>
                <tr class="pure-table-odd">
                    <td>ADMG 101</td>
                    <td>300</td>
                    <td>310</td>
                    <td>200</td>
                    <td>MC1</td>
                    <td><orderCMD modify="true" del="true"></orderCMD></td>
                </tr>
                <tr>
                  <td>ADMG 101</td>
                    <td>300</td>
                    <td>310</td>
                    <td>200</td>
                    <td>MC2</td>
                    <td><orderCMD modify="true" del="true"></orderCMD></td>
                </tr>
                <tr class="pure-table-odd">
                    <td>ADMG 101</td>
                    <td>300</td>
                    <td>310</td>
                    <td>200</td>
                    <td>SmallBox POS 2</td>
                    <td><orderCMD modify="true" del="true"></orderCMD></td>
                </tr>
                <tr>
                  <td>ADMG 301</td>
                    <td>300</td>
                    <td>310</td>
                    <td>200</td>
                    <td>SmallBox POS 4</td>
                    <td><orderCMD modify="true" del="true"></orderCMD></td>
                </tr>
                <template v-for="dt in datiTab" :key="dt.id">
                    <tr  v-if="dt.id<5">
                        <td>{{dt.id}}</td>
                        <td>{{dt.Order}}</td>
                        <td>{{dt.program}}</td>
                        <td>{{dt.Side}}</td>
                        <td>{{dt.start}}</td>
                        <td><orderCMD></orderCMD></td>
                    </tr>
                </template>
            </tbody>
        </table>
      </div>
</template>

<script>
export default {
    data(){
        return {
            datiTab:[]
        }
    },
    methods: {
        getDataTable() {
            fetch('http://127.0.0.1:8080/api/HMI/test',{ method: 'GET'})
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(order => {
                    console.log(JSON.stringify(order,null,4))
                    console.log("quanti:"+order.length)  
                    this.datiTab=order
                })
                .catch(error => {
                    console.info("-------------")
                    console.info(error);
                });
        }
    },
    mounted(){
        this.getDataTable()
    }    
}
</script>

<style scoped>
    .pure-table-horizontal  #td {
        justify-content: center;
        display: flex;
    }
    .pure-table{
        width: inherit;
    }
</style>
