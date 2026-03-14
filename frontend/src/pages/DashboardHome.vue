<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome'">
            <h1 class="mb-3">
                {{ $t("home") }}
            </h1>

            <div class="row first-row">
                <!-- Left -->
                <div class="col-md-7">
                    <!-- Stats -->
                    <div class="shadow-box big-padding text-center mb-4">
                        <div class="row">
                            <div class="col">
                                <h3>{{ $t("active") }}</h3>
                                <span class="num active">{{ activeNum }}</span>
                            </div>
                            <div class="col">
                                <h3>{{ $t("exited") }}</h3>
                                <span class="num exited">{{ exitedNum }}</span>
                            </div>
                            <div class="col">
                                <h3>{{ $t("inactive") }}</h3>
                                <span class="num inactive">{{ inactiveNum }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Docker Run -->
                    <h2 class="mb-3">{{ $t("Docker Run") }}</h2>
                    <div class="mb-3">
                        <textarea id="name" v-model="dockerRunCommand" type="text" class="form-control docker-run shadow-box" required placeholder="docker run ..."></textarea>
                    </div>

                    <button class="btn-normal btn mb-4" @click="convertDockerRun">{{ $t("Convert to Compose") }}</button>

                    <div v-if="$root.isAdmin" class="mb-3">
                        <div class="shadow-box big-padding mb-4">
                            <div class="d-flex flex-wrap justify-content-between align-items-end gap-3">
                                <div class="flex-grow-1">
                                    <h2 class="mb-2">Update All Stacks</h2>
                                    <div class="text-muted small mb-2">
                                        Pull newer images and recreate all managed stacks on the selected node.
                                    </div>
                                    <label class="form-label mb-1">Node</label>
                                    <select v-model="updateAllEndpoint" class="form-select">
                                        <option v-for="option in endpointOptions" :key="`update-${option.value}`" :value="option.value">
                                            {{ option.label }}
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <button class="btn btn-warning" :disabled="updatingAllStacks" @click="updateAllStacks">
                                        {{ updatingAllStacks ? "Updating..." : "Update All" }}
                                    </button>
                                </div>
                            </div>

                            <div v-if="updateAllResult" class="mt-3">
                                <div class="small">
                                    <strong>{{ updateAllResult.msg }}</strong>
                                </div>
                                <div v-if="updateAllResult.results && updateAllResult.results.length > 0" class="small text-muted mt-2 update-results">
                                    <div v-for="result in updateAllResult.results" :key="result.stackName" :class="result.ok ? 'text-success' : 'text-danger'">
                                        {{ result.stackName }}: {{ result.ok ? "updated" : result.error || "failed" }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h2 class="mb-3">Quick Install Apps</h2>
                        <div class="app-grid">
                            <div v-for="app in appCatalog" :key="app.id" class="shadow-box big-padding app-card">
                                <div class="d-flex justify-content-between align-items-start gap-2">
                                    <div>
                                        <h4 class="mb-2">{{ app.name }}</h4>
                                        <div class="text-muted small mb-2">{{ app.category }}</div>
                                    </div>
                                    <span v-if="app.ports.length > 0" class="badge bg-secondary">{{ app.ports.join(", ") }}</span>
                                </div>
                                <p class="mb-3 app-description">{{ app.description }}</p>
                                <button class="btn btn-primary" @click="openInstallDialog(app)">Install</button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Right -->
                <div class="col-md-5">
                    <!-- Agent List -->
                    <div v-if="$root.isAdmin" class="shadow-box big-padding">
                        <h4 class="mb-3">{{ $tc("dockgeAgent", 2) }} <span class="badge bg-warning" style="font-size: 12px;">beta</span></h4>

                        <div v-for="(agentItem, endpoint) in $root.agentList" :key="endpoint" class="mb-3 agent">
                            <!-- Agent Status -->
                            <template v-if="$root.agentStatusList[endpoint]">
                                <span v-if="$root.agentStatusList[endpoint] === 'online'" class="badge bg-primary me-2">{{ $t("agentOnline") }}</span>
                                <span v-else-if="$root.agentStatusList[endpoint] === 'offline'" class="badge bg-danger me-2">{{ $t("agentOffline") }}</span>
                                <span v-else class="badge bg-secondary me-2">{{ $t($root.agentStatusList[endpoint]) }}</span>
                            </template>

                            <!-- Agent Display Name -->
                            <span v-if="endpoint === ''">{{ $t("currentEndpoint") }}</span>
                            <a v-else :href="agentItem.url" target="_blank">{{ endpoint }}</a>

                            <!-- Remove Button -->
                            <font-awesome-icon v-if="endpoint !== ''" class="ms-2 remove-agent" icon="trash" @click="showRemoveAgentDialog[agentItem.url] = !showRemoveAgentDialog[agentItem.url]" />

                            <!-- Remoe Agent Dialog -->
                            <BModal v-model="showRemoveAgentDialog[agentItem.url]" :okTitle="$t('removeAgent')" okVariant="danger" @ok="removeAgent(agentItem.url)">
                                <p>{{ agentItem.url }}</p>
                                {{ $t("removeAgentMsg") }}
                            </BModal>

                            <div v-if="systemSpecs[endpoint]" class="agent-specs mt-2">
                                <div><strong>OS:</strong> {{ systemSpecs[endpoint].platform }} {{ systemSpecs[endpoint].release }} ({{ systemSpecs[endpoint].arch }})</div>
                                <div><strong>CPU:</strong> {{ systemSpecs[endpoint].cpuModel }} · {{ systemSpecs[endpoint].cpuCores }} cores</div>
                                <div><strong>RAM:</strong> {{ formatBytes(systemSpecs[endpoint].totalMemoryBytes) }}</div>
                                <div v-if="systemSpecs[endpoint].gpus.length > 0">
                                    <strong>GPU:</strong> {{ formatGPUList(systemSpecs[endpoint].gpus) }}
                                </div>
                                <div v-else>
                                    <strong>GPU:</strong> GPU not detected
                                </div>
                            </div>
                            <div v-else class="agent-specs mt-2 text-muted">
                                Detecting system specs...
                            </div>
                        </div>

                        <button v-if="!showAgentForm" class="btn btn-normal" @click="showAgentForm = !showAgentForm">{{ $t("addAgent") }}</button>

                        <!-- Add Agent Form -->
                        <form v-if="showAgentForm" @submit.prevent="addAgent">
                            <div class="mb-3">
                                <label for="url" class="form-label">{{ $t("dockgeURL") }}</label>
                                <input id="url" v-model="agent.url" type="url" class="form-control" required placeholder="http://">
                            </div>

                            <div class="mb-3">
                                <label for="username" class="form-label">{{ $t("Username") }}</label>
                                <input id="username" v-model="agent.username" type="text" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">{{ $t("Password") }}</label>
                                <input id="password" v-model="agent.password" type="password" class="form-control" required autocomplete="new-password">
                            </div>

                            <button type="submit" class="btn btn-primary" :disabled="connectingAgent">
                                <template v-if="connectingAgent">{{ $t("connecting") }}</template>
                                <template v-else>{{ $t("connect") }}</template>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <BModal
        v-model="showInstallDialog"
        title="Install App"
        :okTitle="installingApp ? 'Installing...' : 'Install'"
        :okDisabled="installingApp || !selectedApp"
        @ok="installSelectedApp"
    >
        <div v-if="selectedApp">
            <div class="mb-3">
                <label class="form-label">App</label>
                <input class="form-control" :value="selectedApp.name" disabled>
            </div>
            <div class="mb-3">
                <label class="form-label">Stack Name</label>
                <input v-model="installForm.stackName" class="form-control" />
            </div>
            <div class="mb-3">
                <label class="form-label">Node</label>
                <select v-model="installForm.endpoint" class="form-select">
                    <option v-for="option in endpointOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </div>
            <div v-for="field in selectedApp.values" :key="field.key" class="mb-3">
                <label class="form-label">{{ field.label }}</label>
                <input v-model="installForm.values[field.key]" class="form-control" />
                <div v-if="field.description" class="form-text">{{ field.description }}</div>
            </div>

            <div v-if="installingApp" class="alert alert-warning mb-0">
                Install is running. If image pulling gets stuck, you can cancel it.
                <button class="btn btn-sm btn-warning ms-2" @click="cancelInstall">Cancel</button>
            </div>
        </div>
    </BModal>
    <router-view ref="child" />
</template>

<script>
import { statusNameShort } from "../../../common/util-common";
import { BModal } from "bootstrap-vue-next";

export default {
    components: {
        BModal,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0
        }
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            dockerRunCommand: "",
            showAgentForm: false,
            showRemoveAgentDialog: {},
            connectingAgent: false,
            appCatalog: [],
            showInstallDialog: false,
            installingApp: false,
            selectedApp: null,
            installForm: {
                stackName: "",
                endpoint: "",
                values: {},
            },
            systemSpecs: {},
            updateAllEndpoint: "",
            updatingAllStacks: false,
            updateAllResult: null,
            agent: {
                url: "http://",
                username: "",
                password: "",
            }
        };
    },

    computed: {
        activeNum() {
            return this.getStatusNum("active");
        },
        inactiveNum() {
            return this.getStatusNum("inactive");
        },
        exitedNum() {
            return this.getStatusNum("exited");
        },
        endpointOptions() {
            const options = [
                {
                    value: "",
                    label: this.$t("currentEndpoint"),
                }
            ];

            for (const endpoint of Object.keys(this.$root.agentList)) {
                if (!endpoint) {
                    continue;
                }
                options.push({
                    value: endpoint,
                    label: endpoint,
                });
            }

            return options;
        },
    },

    watch: {
        "$root.agentList": {
            handler() {
                this.loadSystemSpecs();
            },
            deep: true,
        },
        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();
        this.loadAppCatalog();
        this.loadSystemSpecs();
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.updatePerPage);
    },

    methods: {

        addAgent() {
            this.connectingAgent = true;
            this.$root.getSocket().emit("addAgent", this.agent, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        url: "http://",
                        username: "",
                        password: "",
                    };
                }

                this.connectingAgent = false;
            });
        },

        removeAgent(url) {
            this.$root.getSocket().emit("removeAgent", url, (res) => {
                if (res.ok) {
                    this.$root.toastRes(res);

                    let urlObj = new URL(url);
                    let endpoint = urlObj.host;

                    // Remove the stack list and status list of the removed agent
                    delete this.$root.allAgentStackList[endpoint];
                    delete this.systemSpecs[endpoint];
                }
            });
        },

        getStatusNum(statusName) {
            let num = 0;

            for (let stackName in this.$root.completeStackList) {
                const stack = this.$root.completeStackList[stackName];
                if (statusNameShort(stack.status) === statusName) {
                    num += 1;
                }
            }
            return num;
        },

        convertDockerRun() {
            if (this.dockerRunCommand.trim() === "docker run") {
                throw new Error("Please enter a docker run command");
            }

            // composerize is working in dev, but after "vite build", it is not working
            // So pass to backend to do the conversion
            this.$root.getSocket().emit("composerize", this.dockerRunCommand, (res) => {
                if (res.ok) {
                    this.$root.composeTemplate = res.composeTemplate;
                    this.$router.push("/compose");
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        loadAppCatalog() {
            if (!this.$root.isAdmin) {
                return;
            }
            this.$root.getSocket().emit("getAppCatalog", (res) => {
                if (res.ok) {
                    this.appCatalog = res.apps;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        updateAllStacks() {
            this.updatingAllStacks = true;
            this.updateAllResult = null;

            this.$root.emitAgent(this.updateAllEndpoint, "updateAllStacks", (res) => {
                this.updatingAllStacks = false;
                this.updateAllResult = res;
                this.$root.toastRes(res);
            });
        },

        openInstallDialog(app) {
            this.selectedApp = app;
            const values = {};
            for (const field of app.values || []) {
                values[field.key] = field.defaultValue;
            }
            this.installForm = {
                stackName: app.defaultStackName,
                endpoint: "",
                values,
            };
            this.showInstallDialog = true;
        },

        installSelectedApp(bvModalEvent) {
            bvModalEvent.preventDefault();
            if (!this.selectedApp) {
                return;
            }
            this.installingApp = true;
            this.$root.emitAgent(this.installForm.endpoint, "installAppTemplate", this.selectedApp.id, {
                stackName: this.installForm.stackName,
                values: this.installForm.values,
            }, (res) => {
                this.installingApp = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.showInstallDialog = false;
                    if (this.installForm.endpoint) {
                        this.$router.push(`/compose/${res.stackName}/${this.installForm.endpoint}`);
                    } else {
                        this.$router.push(`/compose/${res.stackName}`);
                    }
                }
            });
        },

        cancelInstall() {
            if (!this.installForm.stackName) {
                return;
            }
            this.$root.emitAgent(this.installForm.endpoint, "cancelStackOperation", this.installForm.stackName, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.installingApp = false;
                }
            });
        },

        loadSystemSpecs() {
            if (!this.$root.isAdmin) {
                return;
            }

            for (const endpoint of Object.keys(this.$root.agentList)) {
                this.$root.emitAgent(endpoint, "systemSpecs", (res) => {
                    if (res.ok) {
                        this.systemSpecs[endpoint] = res.specs;
                    } else {
                        this.systemSpecs[endpoint] = {
                            platform: "Unknown",
                            release: "",
                            arch: "",
                            cpuModel: "Unknown CPU",
                            cpuCores: 0,
                            totalMemoryBytes: 0,
                            gpus: [],
                        };
                    }
                });
            }
        },

        formatBytes(value) {
            if (!value) {
                return "Unknown";
            }
            const gb = value / 1024 / 1024 / 1024;
            return `${gb.toFixed(1)} GB`;
        },

        formatGPUList(gpus) {
            return gpus.map((gpu) => {
                const details = [ gpu.name ];
                if (gpu.vendor) {
                    details.push(gpu.vendor);
                }
                if (gpu.memoryMB) {
                    details.push(`${gpu.memoryMB} MB`);
                }
                return details.join(" · ");
            }).join(" | ");
        },

        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @returns {void}
         */
        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }

        },
    },
};
</script>

<style lang="scss" scoped>
@import "../styles/vars";

.num {
    font-size: 30px;

    font-weight: bold;
    display: block;

    &.active {
        color: $primary;
    }

    &.exited {
        color: $danger;
    }
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

.docker-run {
    border: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
}

.first-row .shadow-box {

}

.remove-agent {
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
}

.agent {
    a {
        text-decoration: none;
    }
}

.agent-specs {
    font-size: 0.9rem;
    line-height: 1.45;
}

.app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
}

.app-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.app-description {
    min-height: 3.5rem;
}

.update-results {
    max-height: 180px;
    overflow: auto;
}

</style>
