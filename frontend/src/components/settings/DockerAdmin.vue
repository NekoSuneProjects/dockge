<template>
    <div class="docker-admin">
        <div class="toolbar-card shadow-box big-padding mb-4">
            <div class="toolbar-header">
                <div>
                    <h3 class="mb-1">Docker Overview</h3>
                    <div class="text-muted">
                        Review images and containers with filters, cleaner spacing, and paged results.
                    </div>
                </div>
                <div class="toolbar-actions">
                    <button class="btn btn-normal" @click="loadImages">Refresh Images</button>
                    <button class="btn btn-danger" @click="pruneImages">Prune Unused</button>
                    <button class="btn btn-normal" @click="loadContainers">Refresh Containers</button>
                </div>
            </div>

            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-label">Images</div>
                    <div class="summary-value">{{ images.length }}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Used</div>
                    <div class="summary-value">{{ usedImageCount }}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Unused</div>
                    <div class="summary-value">{{ unusedImageCount }}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Containers</div>
                    <div class="summary-value">{{ containers.length }}</div>
                </div>
            </div>
        </div>

        <div class="section-card shadow-box big-padding mb-4">
            <div class="section-header">
                <div>
                    <h4 class="mb-1">Images</h4>
                    <div class="text-muted small">
                        Search by repository, tag, size, digest, or status.
                    </div>
                </div>
                <div class="section-count">
                    {{ filteredImages.length }} shown
                </div>
            </div>

            <div class="controls-grid mb-3">
                <div>
                    <label class="form-label">Search Images</label>
                    <input
                        v-model.trim="imageSearch"
                        type="text"
                        class="form-control"
                        placeholder="Search images"
                    >
                </div>
                <div>
                    <label class="form-label">Usage</label>
                    <select v-model="imageUsageFilter" class="form-select">
                        <option value="all">All images</option>
                        <option value="used">Used only</option>
                        <option value="unused">Unused only</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Per Page</label>
                    <select v-model.number="imagePerPage" class="form-select">
                        <option :value="8">8</option>
                        <option :value="12">12</option>
                        <option :value="20">20</option>
                        <option :value="30">30</option>
                    </select>
                </div>
            </div>

            <div v-if="pagedImages.length === 0" class="empty-state">
                No images matched this filter.
            </div>

            <div v-else class="item-grid">
                <div v-for="image in pagedImages" :key="image.id" class="item-card">
                    <div class="item-top">
                        <div class="item-title-group">
                            <div class="item-title">{{ image.repository }}</div>
                            <div class="item-subtitle">:{{ image.tag }}</div>
                        </div>
                        <span class="status-pill" :class="image.used ? 'status-used' : 'status-unused'">
                            {{ image.used ? "used" : "unused" }}
                        </span>
                    </div>

                    <div class="meta-list">
                        <div><strong>ID</strong> <span>{{ shortID(image.id) }}</span></div>
                        <div><strong>Size</strong> <span>{{ image.size }}</span></div>
                        <div><strong>Created</strong> <span>{{ image.createdSince }}</span></div>
                        <div><strong>Digest</strong> <span>{{ shortDigest(image.digest) }}</span></div>
                    </div>

                    <div class="item-actions">
                        <button class="btn btn-sm btn-outline-danger" @click="removeImage(image.id)">Remove</button>
                    </div>
                </div>
            </div>

            <div v-if="imageTotalPages > 1" class="pagination-row">
                <button class="btn btn-outline-secondary" :disabled="imagePage === 1" @click="imagePage -= 1">Previous</button>
                <button
                    v-for="pageNumber in imageTotalPages"
                    :key="`image-page-${pageNumber}`"
                    class="btn"
                    :class="imagePage === pageNumber ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="imagePage = pageNumber"
                >
                    {{ pageNumber }}
                </button>
                <button class="btn btn-outline-secondary" :disabled="imagePage === imageTotalPages" @click="imagePage += 1">Next</button>
            </div>
        </div>

        <div class="section-card shadow-box big-padding">
            <div class="section-header">
                <div>
                    <h4 class="mb-1">Containers</h4>
                    <div class="text-muted small">
                        Search by name, image, or status, then control containers without a long list.
                    </div>
                </div>
                <div class="section-count">
                    {{ filteredContainers.length }} shown
                </div>
            </div>

            <div class="controls-grid mb-3">
                <div>
                    <label class="form-label">Search Containers</label>
                    <input
                        v-model.trim="containerSearch"
                        type="text"
                        class="form-control"
                        placeholder="Search containers"
                    >
                </div>
                <div>
                    <label class="form-label">Status</label>
                    <select v-model="containerStatusFilter" class="form-select">
                        <option value="all">All containers</option>
                        <option value="running">Running only</option>
                        <option value="stopped">Stopped only</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Per Page</label>
                    <select v-model.number="containerPerPage" class="form-select">
                        <option :value="6">6</option>
                        <option :value="10">10</option>
                        <option :value="16">16</option>
                        <option :value="24">24</option>
                    </select>
                </div>
            </div>

            <div v-if="pagedContainers.length === 0" class="empty-state">
                No containers matched this filter.
            </div>

            <div v-else class="item-grid">
                <div v-for="container in pagedContainers" :key="container.ID" class="item-card">
                    <div class="item-top">
                        <div class="item-title-group">
                            <div class="item-title">{{ container.Names }}</div>
                            <div class="item-subtitle">{{ container.Image }}</div>
                        </div>
                        <span class="status-pill" :class="isRunningContainer(container) ? 'status-used' : 'status-unused'">
                            {{ isRunningContainer(container) ? "running" : "stopped" }}
                        </span>
                    </div>

                    <div class="meta-list">
                        <div><strong>ID</strong> <span>{{ shortID(container.ID) }}</span></div>
                        <div><strong>State</strong> <span>{{ container.State || container.Status }}</span></div>
                        <div><strong>Status</strong> <span>{{ container.Status }}</span></div>
                        <div><strong>Ports</strong> <span>{{ container.Ports || "None" }}</span></div>
                    </div>

                    <div class="container-buttons">
                        <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'start')">Start</button>
                        <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'stop')">Stop</button>
                        <button class="btn btn-sm btn-outline-secondary" @click="containerAction(container.ID, 'restart')">Restart</button>
                        <button class="btn btn-sm btn-outline-danger" @click="containerAction(container.ID, 'rm')">Remove</button>
                    </div>
                </div>
            </div>

            <div v-if="containerTotalPages > 1" class="pagination-row">
                <button class="btn btn-outline-secondary" :disabled="containerPage === 1" @click="containerPage -= 1">Previous</button>
                <button
                    v-for="pageNumber in containerTotalPages"
                    :key="`container-page-${pageNumber}`"
                    class="btn"
                    :class="containerPage === pageNumber ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="containerPage = pageNumber"
                >
                    {{ pageNumber }}
                </button>
                <button class="btn btn-outline-secondary" :disabled="containerPage === containerTotalPages" @click="containerPage += 1">Next</button>
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
            imageSearch: "",
            imageUsageFilter: "all",
            imagePage: 1,
            imagePerPage: 12,
            containerSearch: "",
            containerStatusFilter: "all",
            containerPage: 1,
            containerPerPage: 10,
        };
    },
    computed: {
        usedImageCount() {
            return this.images.filter((image) => image.used).length;
        },

        unusedImageCount() {
            return this.images.filter((image) => !image.used).length;
        },

        filteredImages() {
            const query = this.imageSearch.toLowerCase();

            return this.images.filter((image) => {
                if (this.imageUsageFilter === "used" && !image.used) {
                    return false;
                }
                if (this.imageUsageFilter === "unused" && image.used) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const haystack = [
                    image.repository,
                    image.tag,
                    image.id,
                    image.size,
                    image.createdSince,
                    image.digest,
                    image.used ? "used" : "unused",
                ].join(" ").toLowerCase();

                return haystack.includes(query);
            });
        },

        imageTotalPages() {
            return Math.max(1, Math.ceil(this.filteredImages.length / this.imagePerPage));
        },

        pagedImages() {
            const start = (this.imagePage - 1) * this.imagePerPage;
            return this.filteredImages.slice(start, start + this.imagePerPage);
        },

        filteredContainers() {
            const query = this.containerSearch.toLowerCase();

            return this.containers.filter((container) => {
                const running = this.isRunningContainer(container);

                if (this.containerStatusFilter === "running" && !running) {
                    return false;
                }
                if (this.containerStatusFilter === "stopped" && running) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const haystack = [
                    container.Names,
                    container.Image,
                    container.Status,
                    container.State,
                    container.Ports,
                    container.ID,
                ].join(" ").toLowerCase();

                return haystack.includes(query);
            });
        },

        containerTotalPages() {
            return Math.max(1, Math.ceil(this.filteredContainers.length / this.containerPerPage));
        },

        pagedContainers() {
            const start = (this.containerPage - 1) * this.containerPerPage;
            return this.filteredContainers.slice(start, start + this.containerPerPage);
        },
    },
    watch: {
        imageSearch() {
            this.imagePage = 1;
        },
        imageUsageFilter() {
            this.imagePage = 1;
        },
        imagePerPage() {
            this.imagePage = 1;
        },
        imageTotalPages(newValue) {
            if (this.imagePage > newValue) {
                this.imagePage = newValue;
            }
        },
        containerSearch() {
            this.containerPage = 1;
        },
        containerStatusFilter() {
            this.containerPage = 1;
        },
        containerPerPage() {
            this.containerPage = 1;
        },
        containerTotalPages(newValue) {
            if (this.containerPage > newValue) {
                this.containerPage = newValue;
            }
        },
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
        shortID(value) {
            if (!value) {
                return "Unknown";
            }
            return value.length > 18 ? `${value.slice(0, 18)}...` : value;
        },
        shortDigest(value) {
            if (!value || value === "<none>") {
                return "No digest";
            }
            return value.length > 24 ? `${value.slice(0, 24)}...` : value;
        },
        isRunningContainer(container) {
            const state = String(container.State || container.Status || "").toLowerCase();
            return state.includes("running") || state.includes("healthy") || state.includes("up");
        },
    },
};
</script>

<style scoped lang="scss">
.docker-admin {
    display: grid;
    gap: 1.25rem;
}

.toolbar-card,
.section-card {
    border-radius: 1.2rem;
}

.toolbar-header,
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
}

.toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.9rem;
}

.summary-card {
    padding: 1rem 1.1rem;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.04);
}

.summary-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.7;
}

.summary-value {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1.1;
    margin-top: 0.35rem;
}

.controls-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(180px, 1fr) minmax(140px, 0.8fr);
    gap: 0.9rem;
}

.section-count {
    font-size: 0.9rem;
    opacity: 0.7;
    padding-top: 0.3rem;
}

.item-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1rem;
}

.item-card {
    border-radius: 1rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    display: grid;
    gap: 0.9rem;
}

.item-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
}

.item-title-group {
    min-width: 0;
}

.item-title {
    font-weight: 700;
    font-size: 1rem;
    word-break: break-word;
}

.item-subtitle {
    opacity: 0.72;
    font-size: 0.9rem;
    margin-top: 0.15rem;
    word-break: break-word;
}

.status-pill {
    border-radius: 999px;
    padding: 0.28rem 0.65rem;
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}

.status-used {
    background: rgba(25, 135, 84, 0.22);
    color: #5fe0a2;
}

.status-unused {
    background: rgba(108, 117, 125, 0.28);
    color: #d4d8dd;
}

.meta-list {
    display: grid;
    gap: 0.45rem;
    font-size: 0.9rem;
}

.meta-list div {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 0.65rem;
}

.meta-list span {
    overflow-wrap: anywhere;
    opacity: 0.82;
}

.item-actions,
.container-buttons,
.pagination-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
}

.pagination-row {
    justify-content: center;
    margin-top: 1.25rem;
}

.empty-state {
    padding: 1rem;
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.7);
}

@media (max-width: 900px) {
    .toolbar-header,
    .section-header {
        flex-direction: column;
    }

    .controls-grid {
        grid-template-columns: 1fr;
    }

    .item-grid {
        grid-template-columns: 1fr;
    }
}
</style>
