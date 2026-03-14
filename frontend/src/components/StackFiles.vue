<template>
    <div class="shadow-box big-padding">
        <div class="d-flex gap-2 mb-3 align-items-center">
            <button class="btn btn-normal" @click="loadFiles">Refresh</button>
            <button class="btn btn-normal" :disabled="!selectedFile" @click="downloadFile">Download</button>
            <button class="btn btn-primary" :disabled="!selectedFile" @click="saveFile">Save</button>
            <button class="btn btn-danger" :disabled="!selectedFile" @click="deleteFile">Delete</button>
            <input ref="upload" type="file" class="form-control" @change="uploadFile">
        </div>

        <div class="path-label mb-2">/{{ currentPath }}</div>

        <div class="row">
            <div class="col-lg-4 mb-3">
                <div class="file-list">
                    <div v-if="currentPath" class="file-item" @click="navigateUp()">..</div>
                    <div
                        v-for="file in files"
                        :key="file.name"
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
</template>

<script>
export default {
    props: {
        stackName: {
            type: String,
            required: true,
        },
        endpoint: {
            type: String,
            default: "",
        },
    },
    data() {
        return {
            files: [],
            currentPath: "",
            selectedFile: "",
            fileContent: "",
        };
    },
    watch: {
        stackName() {
            this.currentPath = "";
            this.selectedFile = "";
            this.fileContent = "";
            this.loadFiles();
        },
    },
    mounted() {
        this.loadFiles();
    },
    methods: {
        joinPath(base, segment) {
            return [ base, segment ].filter(Boolean).join("/");
        },
        loadFiles() {
            this.$root.emitAgent(this.endpoint, "stackFileList", this.stackName, this.currentPath, (res) => {
                if (res.ok) {
                    this.files = res.files;
                    this.currentPath = res.cwd || "";
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
            this.$root.emitAgent(this.endpoint, "stackFileRead", this.stackName, nextPath, (res) => {
                if (res.ok) {
                    this.fileContent = res.content;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        navigateUp() {
            const parts = this.currentPath.split("/").filter(Boolean);
            parts.pop();
            this.currentPath = parts.join("/");
            this.selectedFile = "";
            this.fileContent = "";
            this.loadFiles();
        },
        saveFile() {
            this.$root.emitAgent(this.endpoint, "stackFileWrite", this.stackName, this.selectedFile, this.fileContent, (res) => {
                this.$root.toastRes(res);
            });
        },
        deleteFile() {
            this.$root.emitAgent(this.endpoint, "stackFileDelete", this.stackName, this.selectedFile, (res) => {
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
                this.$root.emitAgent(this.endpoint, "stackFileUpload", this.stackName, this.currentPath, file.name, base64, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.loadFiles();
                    }
                });
            };
            reader.readAsDataURL(file);
        },
        downloadFile() {
            this.$root.emitAgent(this.endpoint, "stackFileDownload", this.stackName, this.selectedFile, (res) => {
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
    max-height: 420px;
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
    min-height: 420px;
    font-family: "JetBrains Mono", monospace;
}

.path-label {
    font-family: "JetBrains Mono", monospace;
}
</style>
