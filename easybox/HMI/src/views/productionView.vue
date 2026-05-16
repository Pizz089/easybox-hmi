<script setup>
import { RouterLink, RouterView } from 'vue-router'
import prodtable from '../components/productionTable.vue'
import { dataStored } from '../data';
</script>

<template>
    <div class="pure-u-1">
        <h3>
            &nbsp; {{ $t('production.welcome') }}
            <RouterLink to="/selectPiece">
                <button class="pure-button pure-button-primary"
                    :class="{ 'pure-button-disabled': dataStored.userLevel == 0 }" :id="locked">
                    {{ $t('production.addOrder') }}
                </button>
            </RouterLink>
        </h3>

        <prodtable></prodtable>
    </div>

</template>

<script>
export default {
    computed: {
        locked() {
            if (dataStored.userLevel == 0)
                return 'locked4OP'
            return ''
        }
    }
}
</script>
