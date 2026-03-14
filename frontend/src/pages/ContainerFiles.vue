<template>
    <transition name="slide-fade" appear>
        <div class="container-files-page">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                    <h1 class="mb-1">Container Files</h1>
                    <div class="text-muted">
                        {{ stackName }} / {{ serviceName }}
                        <span v-if="endpointDisplay">({{ endpointDisplay }})</span>
                    </div>
                </div>

                <router-link class="btn btn-normal" :to="composeRoute">
                    Back to Stack
                </router-link>
            </div>

            <div class="shadow-box big-padding mb-3">
                <div class="row g-3 align-items-end">
                    <div class="col-lg-4">
                        <label class="form-label">Container</label>
                        <select v-model="selectedContainerID" class="form-select" @change="resetAndLoadFiles">
                            <option v-for="container in containers" :key="container.id" :value="container.id">
                                {{ container.name }} {{ container.health ? `(${container.health})` : `(${container.state})` }}
                            </option>
                        </select>
                    </div>
                    <div class="col-lg-8">
                        <label class="form-label">Path</label>
                        <div class="input-group">
                            <input v-model="currentPath" class="form-control" @keyup.enter="loadFiles">
                            <button class="btn btn-normal" @click="navigateUp">Up</button>
                            <button class="btn btn-primary" @click="loadFiles">Refresh</button>
                        </div>
                    </div>
                </div>

                <div v-if="selectedContainer" class="small text-muted mt-3">
                    {{ selectedContainer.name }} · {{ selectedContainer.state }}<span v-if="selectedContainer.health"> · {{ selectedContainer.health }}</span>
                </div>
                <div v-else class="small text-muted mt-3">
                    No running container available for this service.
                </div>
            </div>

            <div class="shadow-box big-padding mb-3">
                <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
                    <button class="btn btn-normal" :disabled="!selectedContainerID" @click="loadFiles">Refresh</button>
                    <button class="btn btn-normal" :disabled="!selectedFile" @click="downloadFile">Download</button>
                    <button class="btn btn-primary" :disabled="!selectedFile" @click="saveFile">Save</button>
                    <button class="btn btn-danger" :disabled="!selectedFile" @click="deleteFile">Delete</button>
                    <input ref="upload" type="file" class="form-control upload-input" @change="uploadFile">
                </div>

                <div class="path-label mb-2">{{ currentPath }}</div>

                <div class="row">
                    <div class="col-lg-4 mb-3">
                        <div class="file-list">
                            <div v-if="currentPath !== '/'" class="file-item" @click="navigateUp">..</div>
                            <div
                                v-for="file in files"
                                :key="`${currentPath}-${file.name}`"
                                class="file-item"
                                :class="{ active: selectedFile === joinPath(currentPath, file.name) }"
                                @click="openFile(file)"
                            >
                                {{ file.isDirectory ? "[DIR]" : "[FILE]" }} {{ file.name }}
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <textarea v-model="fileContent" class="form-control editor" :disabled="!selectedFile"></textarea>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    data() {
        return {
            containers: [],
            selectedContainerID: "",
            files: [],
            currentPath: "/",
            selectedFile: "",
            fileContent: "",
        };
    },

    computed: {
        stackName() {
            return this.$route.params.stackName;
        },

        serviceName() {
            return this.$route.params.serviceName;
        },

        endpoint() {
            return this.$route.params.endpoint || "";
        },

        endpointDisplay() {
            return this.$root.agentCount > 1 ? this.$root.endpointDisplayFunction(this.endpoint) : "";
        },

        composeRoute() {
            if (this.endpoint) {
                return `/compose/${this.stackName}/${this.endpoint}`;
            }
            return `/compose/${this.stackName}`;
        },

        selectedContainer() {
            return this.containers.find((container) => container.id === this.selectedContainerID) || null;
        },
    },

    watch: {
        "$route.fullPath"() {
            this.loadContainers();
        },
    },

    mounted() {
        this.loadContainers();
    },

    methods: {
        joinPath(base, segment) {
            const normalizedBase = base === "/" ? "" : base.replace(/\/+$/, "");
            return `${normalizedBase}/${segment}`.replace(/\/+/g, "/");
        },

        loadContainers() {
            this.selectedFile = "";
            this.fileContent = "";
            this.files = [];
            this.currentPath = "/";

            this.$root.emitAgent(this.endpoint, "stackServiceContainers", this.stackName, this.serviceName, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                    return;
                }

                this.containers = res.containers || [];
                this.selectedContainerID = this.containers[0]?.id || "";

                if (this.selectedContainerID) {
                    this.loadFiles();
                }
            });
        },

        resetAndLoadFiles() {
            this.selectedFile = "";
            this.fileContent = "";
            this.currentPath = "/";
            this.loadFiles();
        },

        loadFiles() {
            if (!this.selectedContainerID) {
                return;
            }

            this.$root.emitAgent(this.endpoint, "containerFileList", this.stackName, this.serviceName, this.selectedContainerID, this.currentPath, (res) => {
                if (res.ok) {
                    this.files = res.files;
                    this.currentPath = res.cwd || "/";
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        openFile(file) {
            const nextPath = this.joinPath(this.currentPath, file.name);

            if (file.isDirectory) {
                this.currentPath = nextPath;
                this.selectedFile = "";
                this.fileContent = "";
                this.loadFiles();
                return;
            }

            this.selectedFile = nextPath;
            this.$root.emitAgent(this.endpoint, "containerFileRead", this.stackName, this.serviceName, this.selectedContainerID, nextPath, (res) => {
                if (res.ok) {
                    this.fileContent = res.content;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        navigateUp() {
            if (this.currentPath === "/") {
                return;
            }

            const parts = this.currentPath.split("/").filter(Boolean);
            parts.pop();
            this.currentPath = parts.length > 0 ? `/${parts.join("/")}` : "/";
            this.selectedFile = "";
            this.fileContent = "";
            this.loadFiles();
        },

        saveFile() {
            this.$root.emitAgent(this.endpoint, "containerFileWrite", this.stackName, this.serviceName, this.selectedContainerID, this.selectedFile, this.fileContent, (res) => {
                this.$root.toastRes(res);
            });
        },

        deleteFile() {
            this.$root.emitAgent(this.endpoint, "containerFileDelete", this.stackName, this.serviceName, this.selectedContainerID, this.selectedFile, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.selectedFile = "";
                    this.fileContent = "";
                    this.loadFiles();
                }
            });
        },

        uploadFile(event) {
            const [ file ] = event.target.files;
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = String(reader.result).split(",")[1];
                this.$root.emitAgent(this.endpoint, "containerFileUpload", this.stackName, this.serviceName, this.selectedContainerID, this.currentPath, file.name, base64, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.loadFiles();
                    }
                });
            };
            reader.readAsDataURL(file);
        },

        downloadFile() {
            this.$root.emitAgent(this.endpoint, "containerFileDownload", this.stackName, this.serviceName, this.selectedContainerID, this.selectedFile, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                    return;
                }

                const link = document.createElement("a");
                link.href = `data:application/octet-stream;base64,${res.contentBase64}`;
                link.download = res.fileName;
                link.click();
            });
        },
    },
};
</script>

<style scoped lang="scss">
.file-list {
    max-height: 520px;
    overflow: auto;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 0.75rem;
    padding: 0.5rem;
}

.file-item {
    padding: 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
}

.file-item.active,
.file-item:hover {
    background: rgba(0, 0, 0, 0.05);
}

.editor {
    min-height: 520px;
    font-family: "JetBrains Mono", monospace;
}

.path-label {
    font-family: "JetBrains Mono", monospace;
}

.upload-input {
    max-width: 300px;
}
</style>
