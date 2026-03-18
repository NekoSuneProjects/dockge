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
                            <span v-if="endpoint === ''">{{ buildAgentLabel(endpoint) }}</span>
                            <a v-else :href="agentItem.url" target="_blank">{{ buildAgentLabel(endpoint) }}</a>

                            <span v-if="agentItem.nickname" class="badge bg-secondary ms-2 agent-nickname">{{ agentItem.nickname }}</span>

                            <font-awesome-icon
                                v-if="endpoint !== ''"
                                class="ms-2 remove-agent"
                                icon="pen"
                                @click="openEditAgent(agentItem)"
                            />

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
                                    <div><strong>GPUs:</strong> {{ systemSpecs[endpoint].gpus.length }}</div>
                                    <div
                                        v-for="(gpu, gpuIndex) in systemSpecs[endpoint].gpus"
                                        :key="`${endpoint}-gpu-${gpuIndex}`"
                                        class="gpu-line"
                                    >
                                        <strong>GPU {{ gpuIndex + 1 }}:</strong> {{ formatGPU(gpu) }}
                                    </div>
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
                                <label for="nickname" class="form-label">Nickname</label>
                                <input id="nickname" v-model="agent.nickname" type="text" class="form-control" placeholder="Optional node nickname">
                            </div>

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

                        <BModal
                            v-model="showEditAgentDialog"
                            title="Edit Agent"
                            okTitle="Save"
                            @ok="saveAgentEdit"
                        >
                            <div class="mb-3">
                                <label class="form-label">Nickname</label>
                                <input v-model="editingAgent.nickname" type="text" class="form-control" placeholder="Optional node nickname">
                            </div>

                            <div class="mb-3">
                                <label class="form-label">{{ $t("Username") }}</label>
                                <input v-model="editingAgent.username" type="text" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label class="form-label">{{ $t("Password") }}</label>
                                <input v-model="editingAgent.password" type="password" class="form-control" placeholder="Leave blank to keep existing password" autocomplete="new-password">
                            </div>

                            <div class="text-muted small">{{ editingAgent.url }}</div>
                        </BModal>
                    </div>
                </div>
            </div>
        </div>
    </transition>

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
            systemSpecs: {},
            updateAllEndpoint: "",
            updatingAllStacks: false,
            updateAllResult: null,
            showEditAgentDialog: false,
            editingAgent: {
                url: "",
                username: "",
                password: "",
                nickname: "",
            },
            agent: {
                nickname: "",
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
            const options = [];

            for (const endpoint of Object.keys(this.$root.agentList)) {
                if (this.$root.agentStatusList[endpoint] !== "online") {
                    continue;
                }

                options.push({
                    value: endpoint,
                    label: this.buildEndpointOptionLabel(endpoint),
                });
            }

            if (!options.some((option) => option.value === "")) {
                options.unshift({
                    value: "",
                    label: this.buildEndpointOptionLabel(""),
                });
            }

            return options;
        },
    },

    watch: {
        "$root.agentList": {
            handler() {
                if (!this.endpointOptions.some((option) => option.value === this.updateAllEndpoint)) {
                    this.updateAllEndpoint = this.endpointOptions[0]?.value ?? "";
                }
                this.loadSystemSpecs();
            },
            deep: true,
        },
        "$root.agentStatusList": {
            handler() {
                if (!this.endpointOptions.some((option) => option.value === this.updateAllEndpoint)) {
                    this.updateAllEndpoint = this.endpointOptions[0]?.value ?? "";
                }
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
        this.updateAllEndpoint = this.endpointOptions[0]?.value ?? "";
        this.loadSystemSpecs();
    },

    beforeUnmount() {
        window.removeEventListener("resize", this.updatePerPage);
    },

    methods: {
        buildAgentLabel(endpoint) {
            return this.$root.endpointDisplayFunction(endpoint);
        },

        buildEndpointOptionLabel(endpoint) {
            const status = this.$root.agentStatusList[endpoint];
            const label = this.buildAgentLabel(endpoint);
            return status ? `(${status}) ${label}` : label;
        },

        addAgent() {
            this.connectingAgent = true;
            this.$root.getSocket().emit("addAgent", this.agent, (res) => {
                this.$root.toastRes(res);

                if (res.ok) {
                    this.showAgentForm = false;
                    this.agent = {
                        nickname: "",
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

        openEditAgent(agentItem) {
            this.editingAgent = {
                url: agentItem.url,
                username: agentItem.username,
                password: "",
                nickname: agentItem.nickname || "",
            };
            this.showEditAgentDialog = true;
        },

        saveAgentEdit(bvModalEvent) {
            bvModalEvent.preventDefault();
            this.$root.getSocket().emit("updateAgent", this.editingAgent, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.showEditAgentDialog = false;
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

        updateAllStacks() {
            if (!this.endpointOptions.some((option) => option.value === this.updateAllEndpoint)) {
                this.$root.toastError("Select an online node first.");
                return;
            }

            this.updatingAllStacks = true;
            this.updateAllResult = null;

            this.$root.emitAgent(this.updateAllEndpoint, "updateAllStacks", (res) => {
                this.updatingAllStacks = false;
                this.updateAllResult = res;
                this.$root.toastRes(res);
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

        formatGPU(gpu) {
            const details = [ gpu.name ];
            if (gpu.vendor && !gpu.name?.toLowerCase().includes(String(gpu.vendor).toLowerCase())) {
                details.push(gpu.vendor);
            }
            if (gpu.driverVersion) {
                details.push(`driver ${gpu.driverVersion}`);
            }
            if (gpu.memoryMB) {
                details.push(`${gpu.memoryMB} MB`);
            }
            return details.join(" - ");
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

.agent-nickname {
    font-size: 0.75rem;
}

.agent-specs {
    font-size: 0.9rem;
    line-height: 1.45;
}

.gpu-line {
    margin-top: 0.2rem;
}

.update-results {
    max-height: 180px;
    overflow: auto;
}

</style>
