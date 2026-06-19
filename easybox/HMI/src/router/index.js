import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import dashView from "../views/DashboardView.vue";
import StandardMenu from "../layout/StandardMenu.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      //name: 'home',
      meta: { layout: StandardMenu },
      component: dashView,
    },
    {
      path: "/dashboard",
      name: "dashboard",
      meta: { layout: StandardMenu },
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      //component: () => import('../layout/dashboard/DashboardLayout.vue')
      component: () => import("../views/DashboardView.vue"),
    },
    {
      path: "/production",
      name: "production",
      meta: { layout: StandardMenu },
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
      meta: { layout: StandardMenu },
      component: () => import("../views/unit/robotView.vue"),
    },
    {
      path: "/unit/smallbox",
      name: "unit_smallbox",
      meta: { layout: StandardMenu },
      component: () => import("../views/unit/smallboxView.vue"),
    },
    {
      path: "/unit/CNC1",
      name: "unit_CNC1",
      meta: { layout: StandardMenu },
      component: () => import("../views/unit/CNC1View.vue"),
    },
    {
      path: "/unit/CNC2",
      name: "unit_CNC2",
      meta: { layout: StandardMenu },
      component: () => import("../views/unit/CNC2View.vue"),
    },
    {
      path: "/conf/Grippers",
      name: "grippers",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/GrippersView.vue"),
    },
    {
      path: "/conf/Fixtures",
      name: "fixtures",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/FixturesView.vue"),
    },
    {
      path: "/conf/Fixture",
      name: "Conf_fixture",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Fixture/Fixture.vue"),
    },
    {
      path: "/conf/FixtureOnPallet",
      name: "FixtureOnPallet",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Fixture/FixtureOnPallet.vue"),
    },
    {
      path: "/conf/Grating/:grating_ID",
      name: "Grating",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Grating/Grating.vue"),
    },
    {
      path: "/conf/Gratings",
      name: "Gratings",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/GratingsView.vue"),
    },
    {
      path: "/conf/Gratingtest",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Grating/GratingTest.vue"),
    },
    {
      path: "/conf/importGrating",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Grating/ImportGrating.vue"),
    },
    {
      path: "/conf/Pallets",
      name: "pallets",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/PalletsView.vue"),
    },
    {
      path: "/conf/pallet",
      name: "Pallet",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Pallet/Pallet.vue"),
    },
    {
      path: "/conf/Vices",
      name: "Vices",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/VicesView.vue"),
    },
    {
      path: "/conf/vice",
      name: "Conf_vice",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Vice/Vice.vue"),
    },
    {
      path: "/conf/Parts",
      name: "Parts",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/PartsView.vue"),
    },
    {
      path: "/conf/piece/piece",
      name: "Part",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Piece/Piece.vue"),
    },
    {
      path: "/conf/Trays",
      name: "Trays",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/TraysView.vue"),
    },
    {
      path: "/conf/Gripper/gripper",
      name: "Conf_gripper",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Gripper/Gripper.vue"),
    },
    {
      path: "/conf/tray",
      name: "Conf_tray",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/Tray/Tray.vue"),
    },
    {
      path: "/conf/Position",
      name: "Position",
      meta: { layout: StandardMenu },
      component: () => import("../views/conf/PositionView.vue"),
    },
    //{
    //  path: '/conf/fixtureOnPallet',
    //  name: 'fixtureOnPallet',
    //  meta:{ layout: StandardMenu},
    //  component: () => import('../views/conf/_fixtureOnPallet.vue')
    //},
    {
      path: "/layout/:trayID/:modifyEnable/:floorMag",
      name: "layout",
      meta: { layout: StandardMenu },
      component: () => import("../views/layoutView.vue"),
    },
    {
      path: "/selectPiece",
      name: "selectPiece",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectPiece.vue"),
    },
    {
      path: "/selectGripper",
      name: "selectGripper",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectGripper.vue"),
    },
    {
      path: "/selectPallet",
      name: "selectPallet",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectPallet.vue"),
    },
    {
      path: "/selectVice",
      name: "selectVice",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectVice.vue"),
    },
    {
      path: "/selectFixture",
      name: "selectFixture",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectFixture.vue"),
    },
    {
      path: "/selectMC",
      name: "selectMC",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/selectMC.vue"),
    },
    {
      path: "/lastData",
      name: "lastData",
      meta: { layout: StandardMenu },
      component: () => import("../views/workOrder/lastData.vue"),
    },
    {
      path: "/dispatcher",
      name: "dispatcher",
      //meta:{ layout: StandardMenu},
      component: () => import("../components/dispatch.vue"),
    },
    {
      path: "/diag/mqtt",
      name: "diag_mqtt",
      meta: { layout: StandardMenu },
      component: () => import("../views/diag/MqttDiag.vue"),
    },
    {
      path: "/test",
      name: "test",
      meta: { layout: StandardMenu },
      component: () => import("../views/TestView.vue"),
    },
  ],
});

export default router;
