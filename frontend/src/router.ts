import { createRouter, createWebHistory } from "vue-router";

import Layout from "./layouts/Layout.vue";
import Setup from "./pages/Setup.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Apps from "./pages/Apps.vue";
import AppInstallProgress from "./pages/AppInstallProgress.vue";
import Console from "./pages/Console.vue";
import Compose from "./pages/Compose.vue";
import ContainerFiles from "./pages/ContainerFiles.vue";
import ContainerTerminal from "./pages/ContainerTerminal.vue";

const Settings = () => import("./pages/Settings.vue");

// Settings - Sub Pages
import Appearance from "./components/settings/Appearance.vue";
import General from "./components/settings/General.vue";
const Security = () => import("./components/settings/Security.vue");
const GlobalEnv = () => import("./components/settings/GlobalEnv.vue");
import About from "./components/settings/About.vue";
const UsersAdmin = () => import("./components/settings/UsersAdmin.vue");
const OAuthAdmin = () => import("./components/settings/OAuthAdmin.vue");
const DockerAdmin = () => import("./components/settings/DockerAdmin.vue");

const routes = [
    {
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "DashboardHome",
                        path: "/",
                        component: DashboardHome,
                        children: [
                            {
                                path: "/compose",
                                component: Compose,
                            },
                            {
                                path: "/compose/:stackName/:endpoint",
                                component: Compose,
                            },
                            {
                                path: "/compose/:stackName",
                                component: Compose,
                            },
                            {
                                path: "/terminal/:stackName/:serviceName/:type",
                                component: ContainerTerminal,
                                name: "containerTerminal",
                            },
                            {
                                path: "/terminal/:stackName/:serviceName/:type/:endpoint",
                                component: ContainerTerminal,
                                name: "containerTerminalEndpoint",
                            },
                            {
                                path: "/container-files/:stackName/:serviceName",
                                component: ContainerFiles,
                                name: "containerFiles",
                            },
                            {
                                path: "/container-files/:stackName/:serviceName/:endpoint",
                                component: ContainerFiles,
                                name: "containerFilesEndpoint",
                            },
                        ]
                    },
                    {
                        path: "/console",
                        component: Console,
                    },
                    {
                        path: "/console/:endpoint",
                        component: Console,
                    },
                    {
                        path: "/apps",
                        name: "Apps",
                        component: Apps,
                    },
                    {
                        path: "/apps/install/:appID",
                        name: "AppInstallProgress",
                        component: AppInstallProgress,
                    },
                    {
                        path: "/settings",
                        component: Settings,
                        children: [
                            {
                                path: "general",
                                component: General,
                            },
                            {
                                path: "appearance",
                                component: Appearance,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "globalEnv",
                                component: GlobalEnv,
                            },
                            {
                                path: "about",
                                component: About,
                            },
                            {
                                path: "users",
                                component: UsersAdmin,
                            },
                            {
                                path: "oauth",
                                component: OAuthAdmin,
                            },
                            {
                                path: "docker",
                                component: DockerAdmin,
                            },
                        ]
                    },
                ]
            },
        ]
    },
    {
        path: "/setup",
        component: Setup,
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
