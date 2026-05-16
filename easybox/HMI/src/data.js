import { reactive } from 'vue'

export const dataStored = reactive({
    userLevel: sessionStorage.getItem("userLevel") || 0,
    timeoutUserLevel : 5*60*1000, //5min
    server:"http://127.0.0.1:8080/",

    RobotInLocalMode : true,
    cmdActive        : false,   //il robot puo' eseguire i comandi singoli
    cmdActiveMission : false,   //il robot puo' eseguire le micromissioni

    robotSpeed : 0,
    
    //tipo magazzino
    EasyBox:true,
    RoboBox:false,

    WS:{
      connected:false,
      client:null,
      socket:null,
      diagSocket:null,
      brokerURL:'127.0.0.1:3000'
    },

    searchQuery     : '',
    
    linTollerance   : 5,    //tolleranza ammessa per le correzioni dei movimenti lineari
    rotTollerance   : 15,   //tolleranza ammessa per le correzioni dei movimenti rotativi

	  status_off		: 999,
    status_notDef   : 0,
    status_empty    : 2,
    status_working  : 3,
    status_raw      : 4,
    status_finished : 5,
    status_paused   : 6,
    status_aborted  : 7,
    status_locked   : 9,
    status_auto     : 10,
    status_remote   : 15,
    status_local    : 16,
    status_hold     : 17,
    status_manual   : 20,
    status_alarm    : 99,

    createWorkOrder:{
      pieceID   :-1,
      gripperID :0,
      palletID  :-1,
      fixtureID :-1,
      viceID    :-1,
      machineID :0,
      quantity  :0,
      decentrated_tray_x_pick :0,
      decentrated_tray_y_pick :0,
      decentrated_tray_x_place:0,
      decentrated_tray_y_place:0,
      decentrated_MC_x_pick   :0,
      decentrated_MC_y_pick   :0,
      decentrated_MC_x_place  :0,
      decentrated_MC_y_place  :0,
      option                  :0,
      unloadType              :0,
      approach_type_MC_pick   :0,
      approach_type_MC_place  :0,
      PP                      :''
    },

    emptingStructure(){
      dataStored.createWorkOrder.pieceID                  =-1;
      dataStored.createWorkOrder.gripperID                =0;
      dataStored.createWorkOrder.palletID                 =-1;
      dataStored.createWorkOrder.fixtureID                =-1;
      dataStored.createWorkOrder.viceID                   =-1;
      dataStored.createWorkOrder.machineID                =0;
      dataStored.createWorkOrder.quantity                 =0;
      dataStored.createWorkOrder.decentrated_tray_x_pick  =0;
      dataStored.createWorkOrder.decentrated_tray_y_pick  =0;
      dataStored.createWorkOrder.decentrated_tray_x_place =0;
      dataStored.createWorkOrder.decentrated_tray_y_place =0;
      dataStored.createWorkOrder.decentrated_MC_x_pick    =0;
      dataStored.createWorkOrder.decentrated_MC_y_pick    =0;
      dataStored.createWorkOrder.decentrated_MC_x_place   =0;
      dataStored.createWorkOrder.decentrated_MC_y_place   =0;       
    },

    PartPart         : 1,
    ViceWithoutPart  : 2,
    Pallet           : 3,
    Gripper          : 4,
    ViceWithPart     : 5,
    TRAY             : 6,

    alert:{
      title:'', 
      desc:'',
      type:'alarm',  //warning // message
      check: []  
    },
    emptyAlertList(){
      dataStored.alert.title='';
      dataStored.alert.desc='';
      dataStored.alert.check=[];
    }
  })

