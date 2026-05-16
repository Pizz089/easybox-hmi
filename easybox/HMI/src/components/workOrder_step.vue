<script setup>
    //import { RouterLink, RouterView } from 'vue-router'
    import { dataStored } from '../data.js'
</script>

<template>
    <nav class="breadcrumbs" v-if="dataStored.createWorkOrder.pieceID>=0">
    <!--div class="pure-u-1" v-if="dataStored.createWorkOrder.pieceID>=0"-->
        <br>
        <!--&nbsp; {{$t('WORKORDER')}}: --> &nbsp;
            <span v-if="dataStored.createWorkOrder.pieceID>0" @click="$router.push('/selectPiece')" class="breadcrumbs__item">      
                Piece {{ dataStored.createWorkOrder.pieceID }}    
                <img src="../assets/link.png" width="18px">
            </span> 
            <span v-if="dataStored.createWorkOrder.pieceID==0" @click="$router.push('/selectPiece')" class="breadcrumbs__item">     
                Manual Vice 
                <img src="../assets/link.png" width="18px"> 
            </span> 

            <span v-if="dataStored.createWorkOrder.gripperID>0"  @click="$router.push('/selectGripper')" class="breadcrumbs__item">    
                Gripper {{ dataStored.createWorkOrder.gripperID }} 
                <img src="../assets/link.png" width="18px"> 
            </span> 
            <span v-else class="breadcrumbs__item">&nbsp;</span>

            <span v-if="dataStored.createWorkOrder.palletID>0"  @click="$router.push('/selectPallet')" class="breadcrumbs__item">     
                Pallet {{ dataStored.createWorkOrder.palletID }}  
                <img src="../assets/link.png" width="18px"> 
            </span> 
            <span v-if="dataStored.createWorkOrder.palletID==0"  @click="$router.push('/selectPallet')" class="breadcrumbs__item">     
                NO pallet 
                <img src="../assets/link.png" width="18px"> 
            </span> 

            <span v-if="dataStored.createWorkOrder.fixtureID>0"  @click="$router.push('/selectFixture')" class="breadcrumbs__item">       
                Fixture {{ dataStored.createWorkOrder.fixtureID }}    
                <img src="../assets/link.png" width="18px"> 
            </span> 
            <span v-if="dataStored.createWorkOrder.fixtureID==0"  @click="$router.push('/selectFixture')" class="breadcrumbs__item">       
                NO Fixture
                <img src="../assets/link.png" width="18px"> 
            </span> 

            <span v-if="dataStored.createWorkOrder.machineID>0"  @click="$router.push('/selectMC')" class="breadcrumbs__item">      
                MC {{ dataStored.createWorkOrder.machineID }}   
                <img src="../assets/link.png" width="18px"> 
            </span>
            <span v-else class="breadcrumbs__item">&nbsp;</span>
        &nbsp;
        <img src="../assets/finish2.png" width="28px" height="26px" style="margin-top: 0.6em;"> 
        <!--hr width="80%"-->
        </nav>  
</template>

<script>
    export default {
    }
</script>

<style scoped>
    span{
        margin-right: 5px;
        background-color:lightblue;
        /*background-color:lightblue;
        background-image: url('../assets/link.png');*/
    }

    .breadcrumbs {
        /*border: 1px solid #cbd2d9;*/
        border-radius: 0.3rem;
        display: inline-flex;
        overflow: hidden;
    }

    .breadcrumbs__item {
        background: #fff;
        color: #333;
        outline: none;
        padding: 0.75em 0.75em 0.75em 1.25em;
        position: relative;
        text-decoration: none;
        transition: background 0.2s linear;
    }

    .breadcrumbs__item:hover:after,
    .breadcrumbs__item:hover {
        background: #edf1f5;
    }

    .breadcrumbs__item:focus:after,
    .breadcrumbs__item:focus,
    .breadcrumbs__item.is-active:focus {
        background: #323f4a;
        color: #fff;
    }

    .breadcrumbs__item:after,
    .breadcrumbs__item:before {
        background: white;
        bottom: 0;
        clip-path: polygon(50% 50%, -50% -50%, 0 100%);
        content: "";
        left: 100%;
        position: absolute;
        top: 0;
        transition: background 0.2s linear;
        width: 1em;
        z-index: 1;
    }

    .breadcrumbs__item:before {
        background: #cbd2d9;
        margin-left: 1px;
    }

    .breadcrumbs__item:last-child {
        border-right: none;
    }

    .breadcrumbs__item.is-active {
        background: #edf1f5;
    }

</style>