<template>
    <div>
        <div class="d-flex gap-2 mb-3">
            <button class="btn btn-normal" @click="loadImages">Refresh Images</button>
            <button class="btn btn-danger" @click="pruneImages">Prune Unused Images</button>
            <button class="btn btn-normal" @click="loadContainers">Refresh Containers</button>
        </div>

        <div class="shadow-box big-padding">
            <div v-for="image in images" :key="image.id" class="image-row">
                <div>
                    <div class="fw-bold">{{ image.repository }}:{{ image.tag }}</div>
                    <div class="text-muted small">{{ image.id }} · {{ image.size }} · {{ image.createdSince }}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge" :class="image.used ? 'bg-success' : 'bg-secondary'">{{ image.used ? "used" : "unused" }}</span>
                    <button class="btn btn-sm btn-outline-danger" @click="removeImage(image.id)">Remove</button>
                </div>
            </div>
        </div>

        <div class="shadow-box big-padding mt-3">
            <div v-for="container in containers" :key="container.ID" class="image-row">
                <div>
                    <div class="fw-bold">{{ container.Names }}</div>
                    <div class="text-muted small">{{ container.Image }} · {{ container.Status }}</div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'start')">Start</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'stop')">Stop</button>
                    <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'restart')">Restart</button>
                    <button class="btn btn-sm btn-outline-danger" @click="containerAction(container.ID, 'rm')">Remove</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            images: [],
            containers: [],
        };
    },
    mounted() {
        this.loadImages();
        this.loadContainers();
    },
    methods: {
        loadImages() {
            this.$root.emitAgent("", "dockerImageList", (res) => {
                if (res.ok) {
                    this.images = res.images;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        pruneImages() {
            this.$root.emitAgent("", "pruneUnusedImages", (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadImages();
                }
            });
        },
        removeImage(imageID) {
            this.$root.emitAgent("", "removeDockerImage", imageID, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadImages();
                }
            });
        },
        loadContainers() {
            this.$root.emitAgent("", "dockerContainerList", (res) => {
                if (res.ok) {
                    this.containers = res.containers;
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        containerAction(containerID, action) {
            this.$root.emitAgent("", "dockerContainerAction", containerID, action, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadContainers();
                }
            });
        },
    },
};
</script>

<style scoped lang="scss">
.image-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.image-row:last-child {
    border-bottom: 0;
}
</style>
