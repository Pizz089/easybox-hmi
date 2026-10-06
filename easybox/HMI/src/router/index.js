import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import dashView from "../views/DashboardView.vue";
// (v3, 6/10) nuova shell: barra a sinistra, striscia di stato, schede.
// Gli URL restano TUTTI quelli di prima (test, link, preferiti del
// tablet): cambia solo il layout. StandardMenu resta fino alla fase D.
import AppShell from "../layout/v3/AppShell.vue";
// (machines-gating) guardie di route: l'URL diretto non deve mostrare
// macchine fantasma — se la macchina non e' configurata si torna in dashboard
import { isMachineConfigured } from "../util/machineBrands";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      //name: 'home',
      meta: { layout: AppShell },
      component: dashView,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      meta: { layout: AppShell },
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      //component: () => import('../layout/dashboard/DashboardLayout.vue')
      component: () => import("../views/DashboardView.vue"),
    },
    {
      path: "/production",
      name: "production",
      meta: { layout: AppShell },
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      //component: () => import('../layout/dashboard/DashboardLayout.vue')
      component: () => import("../views/productionView.vue"),
    },
    {
      path: "/changeUser",
      redirect: "/",
    },
    {
      path: "/unit/robot",
      name: "unit_robot",
      meta: { layout: AppShell },
      component: () => import("../views/unit/robotView.vue"),
    },
    {
      path: "/unit/smallbox",
      name: "unit_smallbox",
      meta: { layout: AppShell },
      component: () => import("../views/unit/smallboxView.vue"),
    },
    {
      path: "/unit/CNC1",
      name: "unit_CNC1",
      meta: { layout: AppShell },
      beforeEnter: () => isMachineConfigured(1) || "/dashboard",
      component: () => import("../views/unit/CNC1View.vue"),
    },
    {
      path: "/unit/CNC2",
      name: "unit_CNC2",
      meta: { layout: AppShell },
      beforeEnter: () => isMachineConfigured(2) || "/dashboard",
      component: () => import("../views/unit/CNC2View.vue"),
    },
    {
      path: "/conf/Grippers",
      name: "grippers",
      meta: { layout: AppShell },
      component: () => import("../views/conf/GrippersView.vue"),
    },
    {
      path: "/conf/Fixtures",
      name: "fixtures",
      meta: { layout: AppShell },
      component: () => import("../views/conf/FixturesView.vue"),
    },
    {
      path: "/conf/Fixture",
      name: "Conf_fixture",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Fixture/Fixture.vue"),
    },
    {
      path: "/conf/FixtureOnPallet",
      name: "FixtureOnPallet",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Fixture/FixtureOnPallet.vue"),
    },
    {
      path: "/conf/Grating/:grating_ID",
      name: "Grating",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Grating/Grating.vue"),
    },
    {
      path: "/conf/Gratings",
      name: "Gratings",
      meta: { layout: AppShell },
      component: () => import("../views/conf/GratingsView.vue"),
    },
    // (1/9) rotta /conf/Gratingtest RIMOSSA: GratingTest.vue scrive ancora
    // [POSITION] col mapping pre-luglio (pos.X = width - x, pos.Y = height - y,
    // senza origine tasca 1) e con le delete operative corromperebbe un
    // grigliato in silenzio. Il file resta nel repo: prima di ripristinare la
    // rotta va riallineato a util/gratingAxes.js (drawingToRobot).
    {
      path: "/conf/importGrating",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Grating/ImportGrating.vue"),
    },
    {
      path: "/conf/Warehouses",
      name: "Warehouses",
      meta: { layout: AppShell },
      component: () => import("../views/conf/WarehousesView.vue"),
    },
    {
      path: "/conf/Attrezzaggi",
      name: "Attrezzaggi",
      meta: { layout: AppShell },
      component: () => import("../views/conf/AttrezzaggiView.vue"),
    },
    {
      path: "/conf/Attrezzaggio",
      name: "Conf_attrezzaggio",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Attrezzaggio.vue"),
    },
    {
      path: "/conf/Pallets",
      name: "pallets",
      meta: { layout: AppShell },
      component: () => import("../views/conf/PalletsView.vue"),
    },
    {
      path: "/conf/pallet",
      name: "Pallet",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Pallet/Pallet.vue"),
    },
    {
      path: "/conf/Vices",
      name: "Vices",
      meta: { layout: AppShell },
      component: () => import("../views/conf/VicesView.vue"),
    },
    {
      path: "/conf/vice",
      name: "Conf_vice",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Vice/Vice.vue"),
    },
    {
      path: "/conf/Parts",
      name: "Parts",
      meta: { layout: AppShell },
      component: () => import("../views/conf/PartsView.vue"),
    },
    {
      path: "/conf/piece/piece",
      name: "Part",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Piece/Piece.vue"),
    },
    {
      path: "/conf/Trays",
      name: "Trays",
      meta: { layout: AppShell },
      component: () => import("../views/conf/TraysView.vue"),
    },
    {
      path: "/conf/Gripper/gripper",
      name: "Conf_gripper",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Gripper/Gripper.vue"),
    },
    {
      path: "/conf/tray",
      name: "Conf_tray",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Tray/Tray.vue"),
    },
    {
      path: "/conf/Position",
      name: "Position",
      meta: { layout: AppShell },
      component: () => import("../views/conf/PositionView.vue"),
    },
    // (push-to-stop 15/9) simulazione del ciclo di spinta in battuta. Nessun
    // gate sulla rotta: il livello 0 deve poterla APRIRE, e' la pagina che gli
    // spiega cosa fara' il robot. A essere gated e' la MODIFICA dei parametri,
    // dentro la view.
    {
      path: "/sim/push",
      name: "PushSim",
      meta: { layout: AppShell },
      component: () => import("../views/sim/PushSim.vue"),
    },
    {
      path: "/conf/Machines",
      name: "Machines",
      meta: { layout: AppShell },
      component: () => import("../views/conf/Machine/MachineConfigView.vue"),
    },
    //{
    //  path: '/conf/fixtureOnPallet',
    //  name: 'fixtureOnPallet',
    //  meta:{ layout: AppShell},
    //  component: () => import('../views/conf/_fixtureOnPallet.vue')
    //},
    {
      path: "/layout/:trayID/:modifyEnable/:floorMag",
      name: "layout",
      meta: { layout: AppShell },
      component: () => import("../views/layoutView.vue"),
    },
    {
      path: "/selectRig",
      name: "selectRig",
      meta: { layout: AppShell },
      component: () => import("../views/workOrder/selectRig.vue"),
    },
    {
      path: "/selectPiece",
      name: "selectPiece",
      meta: { layout: AppShell },
      component: () => import("../views/workOrder/selectPiece.vue"),
    },
    {
      path: "/selectGripper",
      name: "selectGripper",
      meta: { layout: AppShell },
      component: () => import("../views/workOrder/selectGripper.vue"),
    },
    // Step demoliti dal cantiere AG (C3): pallet/morsa/attrezzatura derivano
    // dal rig (selectRig). Redirect per link storici: mai schermata vuota.
    {
      path: "/selectPallet",
      redirect: "/selectRig",
    },
    {
      path: "/selectVice",
      redirect: "/selectRig",
    },
    {
      path: "/selectFixture",
      redirect: "/selectRig",
    },
    {
      path: "/selectMC",
      name: "selectMC",
      meta: { layout: AppShell },
      component: () => import("../views/workOrder/selectMC.vue"),
    },
    {
      path: "/lastData",
      name: "lastData",
      meta: { layout: AppShell },
      component: () => import("../views/workOrder/lastData.vue"),
    },
    {
      path: "/dispatcher",
      name: "dispatcher",
      //meta:{ layout: AppShell},
      component: () => import("../components/dispatch.vue"),
    },
    {
      // (v3) pagina Allarmi: in fase A versione di base (unita' in allarme
      // adesso + storico di api/alarm/show/all), in fase D stile HMS
      path: "/alarms",
      name: "alarms",
      meta: { layout: AppShell },
      component: () => import("../views/AlarmsView.vue"),
    },
    {
      // (v3) Impostazioni > Utente e lingua: anche per l'operatore
      path: "/settings/user",
      name: "settings_user",
      meta: { layout: AppShell },
      component: () => import("../views/SettingsUserView.vue"),
    },
    {
      path: "/diag/mqtt",
      name: "diag_mqtt",
      meta: { layout: AppShell },
      component: () => import("../views/diag/MqttDiag.vue"),
    },
    {
      path: "/test",
      name: "test",
      meta: { layout: AppShell },
      component: () => import("../views/TestView.vue"),
    },
  ],
});

export default router;
