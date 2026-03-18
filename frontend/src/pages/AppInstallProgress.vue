<template>
    <div class="install-page">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <h1 class="mb-1">{{ installRequest?.appName || "App Install" }}</h1>
                <div class="text-muted">
                    {{ stackName }} <span v-if="endpointDisplay">on {{ endpointDisplay }}</span>
                </div>
            </div>
            <router-link class="btn btn-normal" to="/apps">Back to Apps</router-link>
        </div>

        <div class="status-shell shadow-box big-padding mb-4">
            <div class="status-row">
                <div>
                    <div class="status-title">{{ statusTitle }}</div>
                    <div class="text-muted">{{ statusMessage }}</div>
                </div>
                <div class="status-badge" :class="statusClass">{{ installState }}</div>
            </div>

            <div class="progress-track mt-3">
                <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <div class="d-flex justify-content-between small text-muted mt-2">
                <span>{{ progressPercent }}%</span>
                <span>{{ progressDetail }}</span>
            </div>

            <div class="action-row mt-4">
                <button v-if="isRunning" class="btn btn-warning" @click="cancelInstall">Cancel Install</button>
                <button v-if="isFailed" class="btn btn-danger" @click="deleteFailedInstall">Delete Failed Install</button>
                <button v-if="isFailed" class="btn btn-normal" @click="retryInstall">Retry</button>
                <button v-if="isSuccess" class="btn btn-primary" @click="openStack">Open Stack</button>
            </div>
        </div>

        <div class="row g-4">
            <div class="col-lg-8">
                <div class="shadow-box big-padding terminal-shell">
                    <div class="terminal-header">
                        <h4 class="mb-0">Install Console</h4>
                    </div>
                    <Terminal
                        ref="installTerminal"
                        v-if="installRequest && terminalName"
                        :key="terminalName"
                        :name="terminalName"
                        :endpoint="endpoint"
                        :rows="18"
                        class="install-terminal"
                    />
                </div>
            </div>
            <div class="col-lg-4">
                <div class="shadow-box big-padding details-card">
                    <h4 class="mb-3">Install Details</h4>
                    <div class="detail-line"><strong>App</strong><span>{{ installRequest?.appName }}</span></div>
                    <div class="detail-line"><strong>Stack</strong><span>{{ stackName }}</span></div>
                    <div class="detail-line"><strong>Node</strong><span>{{ endpointDisplay || "Current" }}</span></div>
                    <div class="detail-line"><strong>State</strong><span>{{ installState }}</span></div>
                    <div class="detail-line"><strong>Last Update</strong><span>{{ lastEventLabel }}</span></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Terminal from "../components/Terminal.vue";
import { getComposeTerminalName } from "../../../common/util-common";

export default {
    components: {
        Terminal,
    },

    data() {
        return {
            installRequest: null,
            installState: "Starting",
            progressPercent: 4,
            progressDetail: "Preparing install",
            lastEventLabel: "Waiting",
            installStarted: false,
            hasTerminalOutput: false,
            terminalListener: null,
            redirectTimeout: null,
            boundTerminalName: "",
        };
    },

    computed: {
        endpoint() {
            return this.installRequest?.endpoint || "";
        },

        stackName() {
            return this.installRequest?.stackName || "";
        },

        terminalName() {
            return getComposeTerminalName(this.endpoint, this.stackName);
        },

        endpointDisplay() {
            if (!this.installRequest) {
                return "";
            }
            return this.$root.endpointDisplayFunction(this.endpoint);
        },

        isRunning() {
            return [ "Starting", "Installing", "Cancelling" ].includes(this.installState);
        },

        isFailed() {
            return this.installState === "Failed";
        },

        isSuccess() {
            return this.installState === "Installed";
        },

        statusTitle() {
            if (this.isSuccess) {
                return "Install Complete";
            }
            if (this.isFailed) {
                return "Failed to Install";
            }
            if (this.installState === "Cancelling") {
                return "Cancelling Install";
            }
            return "Installing";
        },

        statusMessage() {
            if (this.isSuccess) {
                return "Install passed. Opening the stack page next.";
            }
            if (this.isFailed) {
                return "Install failed. You can delete the failed install or retry it.";
            }
            if (this.installState === "Cancelling") {
                return "Stopping the running install operation.";
            }
            return "Pulling images and creating the stack.";
        },

        statusClass() {
            if (this.isSuccess) {
                return "status-success";
            }
            if (this.isFailed) {
                return "status-failed";
            }
            if (this.installState === "Cancelling") {
                return "status-cancelling";
            }
            return "status-installing";
        },
    },

    watch: {
        terminalName() {
            this.syncInstallTerminal();
        },
    },

    mounted() {
        this.installRequest = this.$root.pendingAppInstall;
        if (!this.installRequest || this.installRequest.appID !== this.$route.params.appID) {
            this.$router.replace("/apps");
            return;
        }

        this.syncInstallTerminal();
        this.startInstall();
    },

    beforeUnmount() {
        if (this.terminalListener && this.boundTerminalName) {
            this.$root.removeTerminalListener(this.boundTerminalName, this.terminalListener);
        }
        if (this.redirectTimeout) {
            clearTimeout(this.redirectTimeout);
        }
    },

    methods: {
        attachTerminalListener() {
            if (!this.terminalName) {
                return;
            }

            if (this.terminalListener && this.boundTerminalName && this.boundTerminalName !== this.terminalName) {
                this.$root.removeTerminalListener(this.boundTerminalName, this.terminalListener);
                this.terminalListener = null;
                this.boundTerminalName = "";
            }

            if (this.terminalListener && this.boundTerminalName === this.terminalName) {
                return;
            }

            this.terminalListener = {
                onWrite: (data) => {
                    this.hasTerminalOutput = true;
                    this.updateProgressFromOutput(data);
                },
                onExit: (exitCode) => {
                    this.finishInstall(exitCode === 0);
                },
            };
            this.$root.addTerminalListener(this.terminalName, this.terminalListener);
            this.boundTerminalName = this.terminalName;
        },

        bindInstallTerminal() {
            if (!this.terminalName) {
                return;
            }

            this.$nextTick(() => {
                this.$refs.installTerminal?.bind(this.endpoint, this.terminalName);
            });
        },

        syncInstallTerminal() {
            this.attachTerminalListener();
            this.bindInstallTerminal();
        },

        startInstall() {
            if (this.installStarted) {
                return;
            }

            this.installStarted = true;
            this.installState = "Installing";
            this.progressPercent = 8;
            this.progressDetail = "Starting container install";
            this.lastEventLabel = "Install requested";

            this.$root.emitAgent(this.endpoint, "installAppTemplate", this.installRequest.appID, {
                stackName: this.installRequest.stackName,
                values: this.installRequest.values,
            }, (res) => {
                this.$root.toastRes(res);
                if (!res.ok) {
                    this.installState = "Failed";
                    this.progressPercent = Math.max(this.progressPercent, 100);
                    this.progressDetail = "Install exited with errors";
                    this.lastEventLabel = "Install failed";
                } else if (!this.hasTerminalOutput) {
                    this.progressPercent = Math.max(this.progressPercent, 28);
                    this.progressDetail = "Waiting for docker output";
                    this.lastEventLabel = "Install accepted";
                }
            });
        },

        updateProgressFromOutput(data) {
            const text = String(data || "");
            const condensed = text.replace(/\s+/g, " ").trim();
            this.lastEventLabel = condensed ? condensed.slice(0, 80) : "Live output";

            const runningMatch = text.match(/Running\s+(\d+)\/(\d+)/i);
            if (runningMatch) {
                const current = Number(runningMatch[1]);
                const total = Number(runningMatch[2]);
                if (total > 0) {
                    const percent = Math.round((current / total) * 88) + 8;
                    this.progressPercent = Math.min(96, Math.max(this.progressPercent, percent));
                    this.progressDetail = `${current} of ${total} steps complete`;
                    return;
                }
            }

            if (/pulling/i.test(text)) {
                this.progressPercent = Math.min(90, Math.max(this.progressPercent, 18));
                this.progressDetail = "Pulling images";
                return;
            }

            if (/creating|created|starting/i.test(text)) {
                this.progressPercent = Math.min(95, Math.max(this.progressPercent, 82));
                this.progressDetail = "Creating and starting containers";
                return;
            }

            if (/network|volume/i.test(text)) {
                this.progressPercent = Math.min(70, Math.max(this.progressPercent, 36));
                this.progressDetail = "Preparing docker resources";
                return;
            }

            if (/error|failed|denied|unauthorized|no such/i.test(text)) {
                this.progressPercent = Math.min(99, Math.max(this.progressPercent, 24));
                this.progressDetail = "Docker reported an error";
            }
        },

        finishInstall(ok) {
            if (this.installState === "Cancelling") {
                this.installState = "Failed";
                this.progressPercent = 100;
                this.progressDetail = "Install cancelled";
                return;
            }

            if (ok) {
                this.installState = "Installed";
                this.progressPercent = 100;
                this.progressDetail = "Install finished";
                this.redirectTimeout = setTimeout(() => {
                    this.openStack();
                }, 1400);
            } else {
                this.installState = "Failed";
                this.progressPercent = 100;
                this.progressDetail = "Install exited with errors";
            }
        },

        cancelInstall() {
            this.installState = "Cancelling";
            this.progressDetail = "Stopping install";
            this.$root.emitAgent(this.endpoint, "cancelStackOperation", this.stackName, (res) => {
                this.$root.toastRes(res);
            });
        },

        deleteFailedInstall() {
            this.$root.emitAgent(this.endpoint, "deleteStack", this.stackName, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$root.pendingAppInstall = null;
                    this.$router.push("/apps");
                }
            });
        },

        retryInstall() {
            this.installStarted = false;
            this.installState = "Starting";
            this.progressPercent = 4;
            this.progressDetail = "Preparing install";
            this.lastEventLabel = "Waiting";
            this.hasTerminalOutput = false;
            this.startInstall();
        },

        openStack() {
            this.$root.pendingAppInstall = null;
            if (this.endpoint) {
                this.$router.push(`/compose/${this.stackName}/${this.endpoint}`);
            } else {
                this.$router.push(`/compose/${this.stackName}`);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.install-page {
    padding-bottom: 2rem;
}

.status-shell,
.details-card,
.terminal-shell {
    border-radius: 1.2rem;
}

.status-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.status-title {
    font-size: 1.4rem;
    font-weight: 700;
}

.status-badge {
    padding: 0.5rem 0.85rem;
    border-radius: 999px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
}

.status-installing {
    background: rgba(13, 110, 253, 0.16);
    color: #81b4ff;
}

.status-success {
    background: rgba(25, 135, 84, 0.18);
    color: #5fe0a2;
}

.status-failed {
    background: rgba(220, 53, 69, 0.18);
    color: #ff8c99;
}

.status-cancelling {
    background: rgba(255, 193, 7, 0.18);
    color: #ffd666;
}

.progress-track {
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
}

.progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #4da3ff 0%, #7cc0ff 50%, #8de1c1 100%);
    transition: width 0.25s ease;
}

.action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.terminal-header {
    margin-bottom: 1rem;
}

.install-terminal {
    height: 420px;
}

.details-card {
    display: grid;
    gap: 0.8rem;
}

.detail-line {
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 0.75rem;
}

.detail-line span {
    overflow-wrap: anywhere;
}

@media (max-width: 900px) {
    .status-row {
        flex-direction: column;
    }
}
</style>
