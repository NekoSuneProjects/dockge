<template>
    <div>
        <div class="d-flex gap-2 mb-3">
            <button class="btn btn-primary" @click="addCustomProvider">Add Custom Provider</button>
            <button class="btn btn-normal" @click="load">Refresh</button>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-3">
            <button v-for="preset in presets" :key="preset.id" class="btn btn-outline-secondary btn-sm" @click="addPreset(preset)">
                Add {{ preset.name }}
            </button>
        </div>

        <div v-for="(provider, index) in providers" :key="provider.localKey" class="shadow-box big-padding mb-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">{{ provider.name || "OAuth Provider" }}</h5>
                <button class="btn btn-sm btn-outline-danger" @click="removeProvider(index)">Remove</button>
            </div>

            <div class="form-check form-switch mb-3">
                <input :id="`enabled-${provider.localKey}`" v-model="provider.enabled" class="form-check-input" type="checkbox">
                <label :for="`enabled-${provider.localKey}`" class="form-check-label">Enabled</label>
            </div>

            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label">Provider ID</label>
                    <input v-model="provider.id" class="form-control" placeholder="google" />
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Button Label</label>
                    <input v-model="provider.name" class="form-control" />
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Mode</label>
                    <select v-model="provider.type" class="form-select">
                        <option value="oidc">OIDC Discovery</option>
                        <option value="oauth2">Manual OAuth2</option>
                    </select>
                </div>
            </div>

            <div v-if="provider.type === 'oidc'" class="mb-3">
                <label class="form-label">Discovery URL</label>
                <input v-model="provider.discoveryUrl" class="form-control" placeholder="https://issuer/.well-known/openid-configuration" />
            </div>

            <div v-else>
                <div class="mb-3">
                    <label class="form-label">Authorization Endpoint</label>
                    <input v-model="provider.authorizationEndpoint" class="form-control" />
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Token Endpoint</label>
                        <input v-model="provider.tokenEndpoint" class="form-control" />
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">User Info Endpoint</label>
                        <input v-model="provider.userInfoEndpoint" class="form-control" />
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Client ID</label>
                    <input v-model="provider.clientId" class="form-control" />
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Client Secret</label>
                    <input v-model="provider.clientSecret" class="form-control" type="password" />
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Scopes</label>
                    <input v-model="provider.scopes" class="form-control" />
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Role Claim</label>
                    <input v-model="provider.roleClaim" class="form-control" />
                </div>
            </div>

            <div class="row">
                <div class="col-md-4 mb-3">
                    <label class="form-label">Subject Claim</label>
                    <input v-model="provider.subjectClaim" class="form-control" />
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Username Claim</label>
                    <input v-model="provider.usernameClaim" class="form-control" />
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Display Name Claim</label>
                    <input v-model="provider.displayNameClaim" class="form-control" />
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Admin Role Values</label>
                <input v-model="provider.adminRolesText" class="form-control" placeholder="admin, owner" />
            </div>

            <div class="form-check form-switch mb-2">
                <input :id="`pkce-${provider.localKey}`" v-model="provider.usePKCE" class="form-check-input" type="checkbox">
                <label :for="`pkce-${provider.localKey}`" class="form-check-label">Use PKCE</label>
            </div>
            <div class="form-check form-switch">
                <input :id="`create-${provider.localKey}`" v-model="provider.autoCreateUsers" class="form-check-input" type="checkbox">
                <label :for="`create-${provider.localKey}`" class="form-check-label">Auto create users</label>
            </div>
        </div>

        <button class="btn btn-primary" @click="save">Save OAuth Providers</button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            providers: [],
            presets: [],
        };
    },
    mounted() {
        this.load();
    },
    methods: {
        createProvider(provider = {}) {
            return {
                localKey: `${Date.now()}-${Math.random()}`,
                id: provider.id || "",
                name: provider.name || "OAuth 2",
                enabled: provider.enabled === true,
                type: provider.type || "oidc",
                discoveryUrl: provider.discoveryUrl || "",
                authorizationEndpoint: provider.authorizationEndpoint || "",
                tokenEndpoint: provider.tokenEndpoint || "",
                userInfoEndpoint: provider.userInfoEndpoint || "",
                clientId: provider.clientId || "",
                clientSecret: provider.clientSecret || "",
                scopes: provider.scopes || "openid profile email",
                roleClaim: provider.roleClaim || "roles",
                adminRolesText: Array.isArray(provider.adminRoles) ? provider.adminRoles.join(", ") : "",
                autoCreateUsers: provider.autoCreateUsers !== false,
                subjectClaim: provider.subjectClaim || "sub",
                usernameClaim: provider.usernameClaim || "preferred_username",
                displayNameClaim: provider.displayNameClaim || "name",
                usePKCE: provider.usePKCE !== false,
            };
        },
        load() {
            this.$root.getSocket().emit("adminGetOAuthSettings", (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                    return;
                }
                this.providers = (res.providers || []).map((provider) => this.createProvider(provider));
                this.presets = res.presets || [];
            });
        },
        addPreset(preset) {
            this.providers.push(this.createProvider({
                ...preset,
                enabled: true,
            }));
        },
        addCustomProvider() {
            this.providers.push(this.createProvider({
                enabled: true,
                type: "oauth2",
                name: "Custom OAuth2",
                scopes: "identify email",
                subjectClaim: "sub",
                usernameClaim: "email",
                displayNameClaim: "name",
            }));
        },
        removeProvider(index) {
            this.providers.splice(index, 1);
        },
        save() {
            const payload = this.providers.map((provider) => ({
                id: provider.id,
                name: provider.name,
                enabled: provider.enabled,
                type: provider.type,
                discoveryUrl: provider.discoveryUrl,
                authorizationEndpoint: provider.authorizationEndpoint,
                tokenEndpoint: provider.tokenEndpoint,
                userInfoEndpoint: provider.userInfoEndpoint,
                clientId: provider.clientId,
                clientSecret: provider.clientSecret,
                scopes: provider.scopes,
                roleClaim: provider.roleClaim,
                adminRoles: provider.adminRolesText.split(",").map((item) => item.trim()).filter(Boolean),
                autoCreateUsers: provider.autoCreateUsers,
                subjectClaim: provider.subjectClaim,
                usernameClaim: provider.usernameClaim,
                displayNameClaim: provider.displayNameClaim,
                usePKCE: provider.usePKCE,
            }));

            this.$root.getSocket().emit("adminSetOAuthSettings", {
                providers: payload,
            }, (res) => {
                this.$root.toastRes(res);
            });
        },
    },
};
</script>
