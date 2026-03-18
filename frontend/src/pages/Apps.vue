<template>
    <div class="apps-page">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
                <h1 class="mb-2">Apps</h1>
                <div class="text-muted">
                    Browse one-click installs, search by name, and deploy to any connected node.
                </div>
            </div>
            <div class="summary-card shadow-box">
                <div class="summary-number">{{ filteredApps.length }}</div>
                <div class="text-muted small">matching apps</div>
            </div>
        </div>

        <div v-if="!$root.isAdmin" class="shadow-box big-padding">
            <div class="alert alert-warning mb-0">
                Only admins can access the app installer.
            </div>
        </div>

        <template v-else>
            <div class="shadow-box big-padding mb-4">
                <div class="row g-3 align-items-end">
                    <div class="col-lg-6">
                        <label class="form-label">Search</label>
                        <input
                            v-model.trim="searchQuery"
                            type="text"
                            class="form-control"
                            placeholder="Search apps, categories, ports, or descriptions"
                        >
                    </div>
                    <div class="col-lg-3">
                        <label class="form-label">Category</label>
                        <select v-model="selectedCategory" class="form-select">
                            <option value="">All categories</option>
                            <option v-for="category in categories" :key="category" :value="category">
                                {{ category }}
                            </option>
                        </select>
                    </div>
                    <div class="col-lg-3">
                        <label class="form-label">Page Size</label>
                        <select v-model.number="perPage" class="form-select">
                            <option :value="6">6</option>
                            <option :value="9">9</option>
                            <option :value="12">12</option>
                            <option :value="18">18</option>
                        </select>
                    </div>
                </div>

                <div class="category-pills mt-3">
                    <button
                        class="btn btn-sm"
                        :class="selectedCategory === '' ? 'btn-primary' : 'btn-outline-secondary'"
                        @click="selectedCategory = ''"
                    >
                        All
                    </button>
                    <button
                        v-for="category in categories"
                        :key="`pill-${category}`"
                        class="btn btn-sm"
                        :class="selectedCategory === category ? 'btn-primary' : 'btn-outline-secondary'"
                        @click="selectedCategory = category"
                    >
                        {{ category }}
                    </button>
                </div>
            </div>

            <div v-if="pagedApps.length === 0" class="shadow-box big-padding">
                <div class="text-muted">No apps matched your search.</div>
            </div>

            <div v-else class="app-grid">
                <div v-for="app in pagedApps" :key="app.id" class="shadow-box big-padding app-card">
                    <div>
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div>
                                <h4 class="mb-1">{{ app.name }}</h4>
                                <div class="text-muted small">{{ app.category }}</div>
                            </div>
                            <span v-if="app.ports.length > 0" class="badge bg-secondary">
                                {{ app.ports.join(", ") }}
                            </span>
                        </div>
                        <p class="app-description mb-3">{{ app.description }}</p>
                    </div>

                    <div class="d-flex justify-content-between align-items-center gap-2 mt-3">
                        <span class="small text-muted">
                            {{ app.values.length }} {{ app.values.length === 1 ? "setting" : "settings" }}
                        </span>
                        <button class="btn btn-primary" @click="openInstallDialog(app)">
                            Install
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="totalPages > 1" class="d-flex flex-wrap justify-content-center gap-2 mt-4">
                <button class="btn btn-outline-secondary" :disabled="page === 1" @click="page -= 1">
                    Previous
                </button>
                <button
                    v-for="pageNumber in totalPages"
                    :key="`page-${pageNumber}`"
                    class="btn"
                    :class="page === pageNumber ? 'btn-primary' : 'btn-outline-secondary'"
                    @click="page = pageNumber"
                >
                    {{ pageNumber }}
                </button>
                <button class="btn btn-outline-secondary" :disabled="page === totalPages" @click="page += 1">
                    Next
                </button>
            </div>
        </template>

        <BModal
            v-model="showInstallDialog"
            title="Install App"
            okTitle="Continue"
            :okDisabled="!selectedApp"
            @ok="installSelectedApp"
        >
            <div v-if="selectedApp">
                <div class="mb-3">
                    <label class="form-label">App</label>
                    <input class="form-control" :value="selectedApp.name" disabled>
                </div>
                <div class="mb-3">
                    <label class="form-label">Stack Name</label>
                    <input v-model="installForm.stackName" class="form-control">
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
                    <input v-model="installForm.values[field.key]" class="form-control">
                    <div v-if="field.description" class="form-text">{{ field.description }}</div>
                </div>
            </div>
        </BModal>
    </div>
</template>

<script>
import { BModal } from "bootstrap-vue-next";

export default {
    components: {
        BModal,
    },

    data() {
        return {
            appCatalog: [],
            searchQuery: "",
            selectedCategory: "",
            page: 1,
            perPage: 9,
            showInstallDialog: false,
            selectedApp: null,
            installForm: {
                stackName: "",
                endpoint: "",
                values: {},
            },
        };
    },

    computed: {
        categories() {
            return [ ...new Set(this.appCatalog.map((app) => app.category).filter(Boolean)) ].sort();
        },

        endpointOptions() {
            const options = [
                {
                    value: "",
                    label: this.buildEndpointLabel(""),
                }
            ];

            for (const endpoint of Object.keys(this.$root.agentList)) {
                if (!endpoint || this.$root.agentStatusList[endpoint] !== "online") {
                    continue;
                }

                options.push({
                    value: endpoint,
                    label: this.buildEndpointLabel(endpoint),
                });
            }

            return options;
        },

        filteredApps() {
            const query = this.searchQuery.toLowerCase();

            return this.appCatalog.filter((app) => {
                const matchesCategory = !this.selectedCategory || app.category === this.selectedCategory;
                if (!matchesCategory) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const haystack = [
                    app.name,
                    app.category,
                    app.description,
                    ...(app.ports || []),
                ].join(" ").toLowerCase();

                return haystack.includes(query);
            });
        },

        totalPages() {
            return Math.max(1, Math.ceil(this.filteredApps.length / this.perPage));
        },

        pagedApps() {
            const start = (this.page - 1) * this.perPage;
            return this.filteredApps.slice(start, start + this.perPage);
        },
    },

    watch: {
        selectedCategory() {
            this.page = 1;
        },

        searchQuery() {
            this.page = 1;
        },

        perPage() {
            this.page = 1;
        },

        totalPages(newValue) {
            if (this.page > newValue) {
                this.page = newValue;
            }
        },
    },

    mounted() {
        this.loadAppCatalog();
    },

    methods: {
        buildEndpointLabel(endpoint) {
            const label = this.$root.endpointDisplayFunction(endpoint);
            const status = this.$root.agentStatusList[endpoint];
            return status ? `(${status}) ${label}` : label;
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

        openInstallDialog(app) {
            this.selectedApp = app;
            const values = {};
            for (const field of app.values || []) {
                values[field.key] = field.defaultValue;
            }

            this.installForm = {
                stackName: app.defaultStackName,
                endpoint: this.endpointOptions[0]?.value ?? "",
                values,
            };
            this.showInstallDialog = true;
        },

        installSelectedApp(bvModalEvent) {
            bvModalEvent.preventDefault();
            if (!this.selectedApp) {
                return;
            }

            this.$root.pendingAppInstall = {
                appID: this.selectedApp.id,
                appName: this.selectedApp.name,
                endpoint: this.installForm.endpoint,
                stackName: this.installForm.stackName,
                values: this.installForm.values,
            };
            this.showInstallDialog = false;
            this.$router.push({
                name: "AppInstallProgress",
                params: {
                    appID: this.selectedApp.id,
                },
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.apps-page {
    padding-bottom: 2rem;
}

.summary-card {
    min-width: 120px;
    text-align: center;
}

.summary-number {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
}

.category-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
}

.app-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 220px;
}

.app-description {
    min-height: 4.5rem;
}
</style>
