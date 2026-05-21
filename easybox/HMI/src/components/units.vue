<script setup>
import { dataStored } from '../data.js'
</script>



<!--template vecchio template >
    //{{ alarm }}
        
            <div class="pure-g">
                <span class="pure-u-1">
                    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
                        <div class="card link" @click="$router.push('/unit/robot');">

                            <img src="../assets/robot.png" alt="robot" class="pure-robot" :class="getStatus(robot_status)">
                            <div class="container" style="padding-bottom: 0px;">
                                <h4><b>{{ $t(robot_desc) }}</b></h4>
                                //{{robotAlarm>0?'Alarm  '+$t('robot.alarm_'+robotAlarm):'&nbsp;'}}
                                <h6 v-if="robot_status == 99 && robotAlarm > 0">
                                    Alarm: {{ $t('robot.alarm_' + robotAlarm) }}
                                </h6>
                                <h6 v-if="robot_status != 99 && robotAlarm.length > 2">
                                    {{ robotAlarm }}
                                </h6>
                                <h6 v-else>&nbsp;</h6>
                            </div>
                        </div>
                    </div>

                    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
                        <div class="card link" @click="$router.push('/unit/smallbox');">

                            <img src="../assets/smallbox.png" alt="smallbox" class="pure-smallbox" style="padding: 0px"
                                :class="getStatus(smallBox_status)">
                            <div class="container" style="padding: 0px;padding-bottom: 0px;">
                                //<b>{{$t('unit.smallbox.raw_parts')}} {{ rawParts }}</b>
                                <h4><b>{{ $t(smallBox_desc) }}</b></h4>
                                <h6><b>&nbsp;</b><br></h6>
                            </div>
                        </div>
                    </div>

                    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
                        <div class="card link" @click="$router.push('/unit/cnc1');">
                            <img src="../assets/cnc.svg" alt="cnc" class="pure-cnc" style="padding: 2px 20px 4px 20px;"
                                :class="getStatus(mc1_status)">

                            <div class="container">
                                <h4><b>{{ $t(cnc1_desc) }} </b></h4>
                                <h6><b>{{ $t('unit.order') }} {{ cnc1_order }}</b></h6>
                            </div>
                            //<progress max="100" value="0" style="width:60%"> 0 </progress>
                        </div>
                    </div>

                    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
                        <div class="card  link" @click="$router.push('/unit/cnc2');">
                            <img src="../assets/cnc.svg" alt="cnc" class="pure-cnc2" style="padding: 2px 20px 4px 20px;"
                                :class="getStatus(mc2_status)">
                            <div class="container">
                                <h4><b>{{ $t(cnc2_desc) }}</b></h4>
                                <h6><b>{{ $t('unit.order') }} {{ cnc2_order }}</b></h6>

                            </div>
                            //<progress max="100" value="40" style="width:60%"> 0 </progress>
                        </div>
                    </div>
                </span>
            </div>
        
</template-->
<template>
    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
        <div class="card link" style="--tile-w:220px; --tile-h:150px; --img-max:100px;"
            @click="$router.push('/unit/robot');">
            <div class="img-wrapper" :class="getStatus(robot_status)">
                <img src="../assets/robot.png" alt="robot" class="pure-robot">
            </div>
            <div class="container" style="padding-bottom: 0px;">
                <h4><b>{{ $t(robot_desc) }}</b></h4>
                <h6 v-if="robot_status == 99 && robotAlarm > 0">Alarm: {{ $t('robot.alarm_' + robotAlarm) }}</h6>
                <h6 v-if="robot_status != 99 && robotAlarm.length > 2">{{ robotAlarm }}</h6>
                <h6 v-else>&nbsp;</h6>
            </div>
        </div>
    </div>



    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
        <div class="card link" style="--tile-w:220px; --tile-h:200px; --img-max:300px;"
            @click="$router.push('/unit/smallbox');">
            <div class="img-wrapper" :class="getStatus(smallBox_status)">
                <img src="../assets/smallbox.png" alt="smallbox" class="pure-smallbox">
            </div>
            <div class="container" style="padding: 0px;padding-bottom: 0px;">
                <h4><b>{{ $t(smallBox_desc) }}</b></h4>
                <h6><b>&nbsp;</b><br></h6>
            </div>
        </div>
    </div>

    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
        <div class="card link" style="--tile-w:220px; --tile-h:150px; --img-max:95px;"
            @click="$router.push('/unit/cnc1');">
            <div class="img-wrapper" :class="getStatus(mc1_status)">
                <img src="../assets/cnc.svg" alt="cnc" class="pure-cnc">
            </div>
            <div class="container">
                <h4><b>{{ $t(cnc1_desc) }} </b></h4>
                <h6><b>{{ $t('unit.order') }} {{ cnc1_order }}</b></h6>
            </div>
        </div>
    </div>

    <div class="container_card pure-u-1 pure-u-md-1-2 pure-u-lg-1-4">
        <div class="card link" style="--tile-w:220px; --tile-h:150px; --img-max:95px;"
            @click="$router.push('/unit/cnc2');">
            <div class="img-wrapper" :class="getStatus(mc2_status)">
                <img src="../assets/cnc.svg" alt="cnc" class="pure-cnc2">
            </div>
            <div class="container">
                <h4><b>{{ $t(cnc2_desc) }}</b></h4>
                <h6><b>{{ $t('unit.order') }} {{ cnc2_order }}</b></h6>
            </div>
        </div>
    </div>

</template>


<script>
export default {
    data() {
        return {
            unitList: {},
            robot_desc: 'unit.robot.load1', //vado a cercare nelle traduzioni : 'Tray11 Pos22 => MC1',
            cnc1_desc: 'unit.cnc1.auto',
            cnc2_desc: 'unit.cnc2.auto',
            smallBox_desc: 'unit.smallbox.auto',
            rawParts: 200,
            cnc1_order: '',
            cnc2_order: '120-203',
            robotAlarm: 0,
            smallBoxAlarm: false,
            mc1Alarm: false,
            mc2Alarm: false,
            robot_status: '',
            smallBox_status: '',
            mc1_status: '',
            mc2_status: '',
            mc1_Fixture: 0,
            mc1_Pallet: 0,
            mc2_Fixture: 0,
            mc2_Pallet: 0,
        };
    },
    methods: {
        getStatusList() {
            fetch(dataStored.server + 'api/unit/show/all', { method: 'GET' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json()
                })
                .then(data => {
                    //if (!JSON.stringify(this.unitList)===JSON.stringify(data)){
                    this.unitList = data;
                    //console.log(JSON.stringify(this.unitList[0].UNIT,null,4))
                    for (let i = 0; i < this.unitList.length; i++) {
                        if (this.unitList[i].UNIT == 'ROBOT') {
                            this.robot_status = this.unitList[i].STATUS
                            this.robotAlarm = this.unitList[i].DESCR;
                            this.robot_desc = this.getStatusDesc("robot", this.unitList[i].STATUS)
                        }
                        if (this.unitList[i].UNIT == 'SMALLBOX') {
                            this.smallBox_status = this.unitList[i].STATUS
                            this.smallBoxAlarm = this.unitList[i].STATUS == dataStored.status_alarm;
                            this.smallBox_desc = this.getStatusDesc("smallbox", this.unitList[i].STATUS)
                        }
                        if (this.unitList[i].UNIT == 'MC1') {
                            //if (this.unitList[i].STATUS>1000)
                            //    this.unitList[i].STATUS=this.unitList[i].STATUS-1000
                            //if (this.unitList[i].STATUS>100)
                            //    this.unitList[i].STATUS=this.unitList[i].STATUS-100
                            this.mc1_status = this.unitList[i].STATUS
                            this.mc1Alarm = this.unitList[i].STATUS == dataStored.status_alarm;
                            this.mc1_Fixture = this.unitList[i].FIXTURE
                            this.mc1_Pallet = this.unitList[i].PALLET
                            this.cnc1_desc = this.getStatusDesc("cnc1", this.unitList[i].STATUS)
                        }
                        if (this.unitList[i].UNIT == 'MC2') {
                            //if (this.unitList[i].STATUS>1000)
                            //    this.unitList[i].STATUS=this.unitList[i].STATUS-1000
                            //if (this.unitList[i].STATUS>100)
                            //    this.unitList[i].STATUS=this.unitList[i].STATUS-100

                            this.mc2_status = this.unitList[i].STATUS
                            this.mc2Alarm = this.unitList[i].STATUS == dataStored.status_alarm;
                            this.mc2_Fixture = this.unitList[i].FIXTURE
                            this.mc2_Pallet = this.unitList[i].PALLET
                            this.cnc2_desc = this.getStatusDesc("cnc2", this.unitList[i].STATUS)
                        }
                    }
                    //}
                    console.log("ricevo " + data.length + " unit");//+JSON.stringify(data,null,4))
                })
                .catch(error => {
                    console.info(error);
                    this.smallBoxAlarm = 1000;
                    this.robotAlarm = 1000;
                    this.mc1Alarm = 1000;
                    this.mc2Alarm = 1000;
                    this.robot_status = dataStored.status_alarm;
                    this.smallBox_status = dataStored.status_alarm;
                    this.mc1_status = dataStored.status_alarm;
                    this.mc2_status = dataStored.status_alarm;
                    dataStored.alert.title = "ALLARME";
                    dataStored.alert.desc = this.$t("robot.alarm_900000")
                });
        },
        getStatus(status) {
            switch (status) {
                case dataStored.status_off: return "off"; break;
                case dataStored.status_alarm: return "alarm"; break;
                case dataStored.status_auto: return "auto"; break;
                case dataStored.status_remote: return "auto"; break;
                case dataStored.status_local: return "auto"; break;
                case dataStored.status_manual: return "manual"; break;
                case dataStored.status_working: return "working"; break;
                case dataStored.status_hold: return "hold"; break;
                case dataStored.status_notDef: return "alarm"; break;
            }
            return "normal";
        },
        getStatusDesc(unit, status) {
            switch (status) {
                case dataStored.status_off: return "unit." + unit + ".off"; break;
                case dataStored.status_alarm: return "unit." + unit + ".alarm"; break;
                case dataStored.status_auto: return "unit." + unit + ".auto"; break;
                case dataStored.status_remote: return "unit." + unit + ".remote"; break;
                case dataStored.status_manual: return "unit." + unit + ".manual"; break;
                case dataStored.status_local: return "unit." + unit + ".local"; break;
                case dataStored.status_working: return "unit." + unit + ".working"; break;
                case dataStored.status_notDef: return "unit." + unit + ".not_Def"; break;
                case dataStored.status_hold: return "HOLD"; break;
            }
            return "normal";
        }
    },
    mounted() {
        this.getStatusList()

        dataStored.WS.socket.on("ROBOT/STATUS", payload => {
            this.robot_status = parseInt(payload.toString());
            this.robot_desc = this.getStatusDesc("robot", this.robot_status);
            //dataStored.alert.title= "ROBOT in modalita "+this.robot_status
            //dataStored.alert.desc= this.robot_desc
        });
        dataStored.WS.socket.on("BOX/STATUS", payload => {
            this.smallBox_status = parseInt(payload.toString());
            this.smallBox_desc = this.getStatusDesc("smallbox", this.smallBox_status);
        });
        //dataStored.WS.socket.on("BOX/EXTRACT", payload =>{
        //    this.smallBox_desc = "Extract Tray:"+parseInt(payload.toString());
        //});
        dataStored.WS.socket.on("MC1/STATUS", payload => {
            this.mc1_status = parseInt(payload.toString());
            this.cnc1_desc = this.getStatusDesc("cnc1", this.mc1_status);
        });
        dataStored.WS.socket.on("MC2/STATUS", payload => {
            this.mc2_status = parseInt(payload.toString());
            this.cnc2_desc = this.getStatusDesc("cnc2", this.mc2_status);
        });

        dataStored.WS.socket.on("ROBOT/DESCR", payload => {
            //this.getStatusList();
            this.robotAlarm = payload;
        });
    },
    unmounted() {
        //dataStored.WS.socket.off('ROBOT/STATUS');
        //dataStored.WS.socket.off('BOX/STATUS');
        ////dataStored.WS.socket.off('BOX/EXTRACT');
        //dataStored.WS.socket.off('MC1/STATUS');
        //dataStored.WS.socket.off('MC2/STATUS');

        //dataStored.WS.socket.off("ROBOT/DESCR");
    }
}
</script>


<style scoped>
/* ============ CARD ============ */
.card {
    background: var(--bg-surface);
    border: 0;
    border-radius: var(--radius-lg);
    box-shadow: var(--elevation-2);
    transition:
        box-shadow var(--transition-base),
        transform var(--transition-fast);

    padding: var(--space-5) var(--space-3) var(--space-3);
    margin: var(--space-3) var(--space-2) 0;

    display: grid;
    place-items: center;
}

.card:hover {
    box-shadow: var(--elevation-3);
}

.card img {
    border-radius: 22px;
    padding: 2px;
}


/* ============ STATUS (applicato a .img-wrapper) ============ */
/* HMI: border spessi (3-4px) per leggibilita' a colpo d'occhio dal lato.
   .normal e' 2px perche' e' lo stato idle/default (non deve catturare). */

.img-wrapper.normal {
    background: var(--bg-surface-2);
}

.img-wrapper.auto,
.img-wrapper.remote,
.img-wrapper.local {
    background: var(--color-success);
}

.img-wrapper.manual {
    background: var(--color-warning);
}

.img-wrapper.working {
    background: var(--color-info-bg);
}

.img-wrapper.alarm {
    background: var(--color-danger);
    /* glow esterno: HMI deve gridare l'allarme da lontano */
    box-shadow: 0 0 8px var(--color-danger);
}

.img-wrapper.hold {
    background: var(--color-info);
    animation: blinker 1s linear infinite;
}

/* Blink: pulse background tra color-info e accent-hover (entrambi blu).
   Refactored da border-color a background dopo rimozione bordi UI-3.3. */
@keyframes blinker {
    80% {
        background: var(--accent-hover);
    }
}


/* ============ TIPOGRAFIA ============ */
.container {
    padding: var(--space-1) var(--space-4);
}

.card h4 {
    color: var(--text-primary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: var(--space-2) 0 var(--space-1);
}

.card h6 {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-normal);
    margin: 0;
}

.center {
    justify-content: center;
}


/* ============ GEOMETRIA IMG (preservata) ============ */
.img-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 90px;
    border-radius: 13px !important;
    margin: 0 auto var(--space-2);
    overflow: hidden;
}

.card .pure-robot,
.card .pure-cnc,
.card .pure-cnc2 {
    width: 100px;
    height: 90px;
    object-fit: contain;
    display: block;
    margin: var(--space-2) auto var(--space-1);
    border-radius: 13px;
}

.pure-smallbox {
    max-width: 140px;
    max-height: 120px;
    background-color: transparent;
}
</style>