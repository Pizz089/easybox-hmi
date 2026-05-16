import { dataStored } from "../data";

export function sendToRobot(val) {
    dataStored.WS.socket.emit("TO_PLANT/CMD/ROBOT", val);
}

//export function cmdActiveMission(){
//    if (!dataStored.RobotInLocalMode || 
//        this.dataGripper.ID == null ||
//        this.dataRobot.STATUS==dataStored.status_off || 
//        this.dataRobot.STATUS==dataStored.status_hold ||
//        this.dataRobot.STATUS==dataStored.status_notDef ) 
//        return 0;
//    else 
//        return 1;
//}

