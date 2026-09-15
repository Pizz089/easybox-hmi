import { reactive } from 'vue'

// (origine singola) Il pannello parla SOLO con l'origine da cui e' stato
// caricato. Le chiamate dati e il socket ci arrivano lo stesso, perche' Vite
// le gira al backend (server.proxy in vite.config.js).
//
// PRIMA erano tre origini: la pagina sulla 5173, i dati sulla 8080, il socket
// sulla 3000, con l'indirizzo ricostruito a mano da window.location.hostname.
// Funzionava, ma dipendeva da come era stato digitato l'indirizzo, e teneva
// aperte due porte in piu' verso la rete di cella.
//
// E' anche la condizione per poter accendere HTTPS senza riscrivere niente:
// con tre origini in chiaro, una pagina servita in https vedrebbe i dati e il
// socket BLOCCATI dal browser come contenuto misto, e il pannello smetterebbe
// di funzionare. Con l'origine singola il certificato riguarda un indirizzo
// solo.

export const dataStored = reactive({
    userLevel: sessionStorage.getItem("userLevel") || 0,
    timeoutUserLevel : 5*60*1000, //5min
    // relativo di proposito: vale tale e quale da localhost (touch di cella)
    // e da indirizzo IP (tablet), che oggi sono due percorsi diversi
    server:'/',

    cmdActive        : false,   //il robot puo' eseguire i comandi singoli
    cmdActiveMission : false,   //il robot puo' eseguire le micromissioni (hold + pinza a bordo)
    cmdActiveLoad    : false,   //missione CARICA PINZA (hold + NESSUNA pinza a bordo)
    cmdActivePallet  : false,   //missioni CARICA/SCARICA PALLET (hold + pinza a bordo)

    robotSpeed : 0,

    // (AN 1-bis) precondizione ausiliari da FROM_PLANT/SAFETY/AUX:
    // null = mai ricevuto (nessun banner: mai allarmi su dato mancante),
    // 0 = non ripristinati (banner+hint), 1 = ok. Listener globale in
    // StandardMenu, le viste leggono da qui.
    safetyAux : null,
    
    //tipo magazzino
    EasyBox:true,
    RoboBox:false,

    WS:{
      connected:false,
      client:null,
      socket:null,
      diagSocket:null,
      // il socket passa dalla stessa origine: io(brokerURL) e
      // io(brokerURL + '/diag') restano identici, cambia solo dove puntano
      brokerURL:window.location.origin
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
      // Convenzioni PLC (cantiere AG fase 2, riviste il 15/9): VICE_ID=0
      // SEMPRE (mai -1); palletID reale sempre.
      // FIXTURE_ID: REALE IN ENTRAMBI I RAMI — e' la GEOMETRIA di cio' che
      // sta sul pallet (riga FIXTURE_ON_PALLET). Il PLC calcola la quota di
      // deposito in macchina come P.Z + PIECE.Z_PLACE + FIXTURE.Z con un join
      // INTERNO su FIXTURE e non conosce VICE: con FIXTURE_ID 0 non trova
      // righe e va in errore 799 col robot gia' in movimento. Prima il ramo
      // morsa scriveva 0 per convenzione: era la causa del fermo del 15/9.
      // ramo morsa: pieceID reale, gripperID reale, declaredPieceID 0/NULL;
      // ramo attrezzatura: pieceID=0 (un PIECE_ID!=0 farebbe partire una
      // missione di carico dal magazzino), gripperID=0, declaredPieceID=pezzo
      // dichiarato (sorgente del PP).
      rigType   :'',       // '' | 'vice' | 'fixture' — ramo del wizard (solo client)
      declaredPieceID:0,   // pezzo dichiarato ramo attrezzatura -> WORKORDER.DECLARED_PIECE_ID
      pieceID   :-1,
      gripperID :0,
      palletID  :-1,
      fixtureID :0,        // 0 = non ancora scelto; all'ordine DEVE essere > 0
      viceID    :0,
      machineID :0,
      quantity  :0,
      // (1/9) gli 8 decentramenti X/Y (decentrated_tray_*/decentrated_MC_*)
      // NON esistono piu' nel payload: la regolazione della presa e' solo
      // in Z (PIECE.Z_PICK/Z_PLACE); il backend scrive le colonne a 0 fisso.
      option                  :0,
      unloadType              :0,
      approach_type_MC_pick   :0,
      approach_type_MC_place  :0,
      PP                      :''
    },

    emptingStructure(){
      dataStored.createWorkOrder.rigType                  ='';
      dataStored.createWorkOrder.declaredPieceID          =0;
      dataStored.createWorkOrder.pieceID                  =-1;
      dataStored.createWorkOrder.gripperID                =0;
      dataStored.createWorkOrder.palletID                 =-1;
      dataStored.createWorkOrder.fixtureID                =0;   //convenzione PLC: mai -1
      dataStored.createWorkOrder.viceID                   =0;   //convenzione PLC: mai -1
      dataStored.createWorkOrder.machineID                =0;
      dataStored.createWorkOrder.quantity                 =0;
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

