<template>
    <div>
        <div class="d-flex gap-2 mb-3">
            <button class="btn btn-primary" @click="newUser">New User</button>
            <button class="btn btn-normal" @click="loadUsers">Refresh</button>
        </div>

        <div class="row">
            <div class="col-lg-5 mb-3">
                <div class="shadow-box big-padding">
                    <div
                        v-for="user in users"
                        :key="user.id"
                        class="user-row"
                        :class="{ active: editUser.id === user.id }"
                        @click="selectUser(user)"
                    >
                        <div class="fw-bold">
                            {{ user.username }}
                            <span v-if="user.owner" class="badge bg-dark ms-2">OWNER</span>
                        </div>
                        <div class="text-muted small">{{ user.role }} · {{ user.authProvider }}</div>
                    </div>
                </div>
            </div>

            <div class="col-lg-7">
                <div class="shadow-box big-padding">
                    <div v-if="editUser.owner" class="alert alert-secondary">
                        This bootstrap owner account is permanently locked as admin. It cannot be edited, reassigned, disabled, or deleted unless Dockge is fully wiped and reinstalled.
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Username</label>
                        <input v-model="editUser.username" class="form-control" :disabled="editUser.owner" />
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Display Name</label>
                        <input v-model="editUser.displayName" class="form-control" :disabled="editUser.owner" />
                    </div>
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Role</label>
                            <select v-model="editUser.role" class="form-select" :disabled="editUser.owner">
                                <option value="admin">admin</option>
                                <option value="user">user</option>
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label class="form-label">Auth Provider</label>
                            <select v-model="editUser.authProvider" class="form-select" :disabled="editUser.owner">
                                <option value="local">local</option>
                                <option value="oauth">oauth</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input v-model="editUser.password" class="form-control" type="password" :disabled="editUser.owner" :placeholder="editUser.id ? 'Leave blank to keep current password' : 'Required for local users'" />
                    </div>

                    <div class="mb-3">
                        <label class="form-label">Allowed Stacks</label>
                        <div class="access-grid">
                            <label v-for="stack in stackChoices" :key="stack.key" class="access-item">
                                <input v-model="selectedAssignments" type="checkbox" :value="stack.key" :disabled="editUser.owner" />
                                <span>{{ stack.label }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="d-flex gap-2">
                        <button class="btn btn-primary" :disabled="editUser.owner" @click="saveUser">Save</button>
                        <button v-if="editUser.id" class="btn btn-danger" :disabled="editUser.owner" @click="deleteUser">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            users: [],
            editUser: {
                id: 0,
                username: "",
                displayName: "",
                role: "user",
                authProvider: "local",
                password: "",
                owner: false,
            },
            selectedAssignments: [],
        };
    },
    computed: {
        stackChoices() {
            return Object.values(this.$root.completeStackList).map((stack) => ({
                key: `${stack.endpoint || ""}:::${stack.name}`,
                label: `${stack.name}${stack.endpoint ? ` (${stack.endpoint})` : ""}`,
            }));
        },
    },
    mounted() {
        this.loadUsers();
    },
    methods: {
        emptyUser() {
            return {
                id: 0,
                username: "",
                displayName: "",
                role: "user",
                authProvider: "local",
                password: "",
                owner: false,
            };
        },
        loadUsers() {
            this.$root.getSocket().emit("adminListUsers", (res) => {
                if (res.ok) {
                    this.users = res.users;
                    if (!this.editUser.id && this.users.length > 0) {
                        this.selectUser(this.users[0]);
                    }
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        newUser() {
            this.editUser = this.emptyUser();
            this.selectedAssignments = [];
        },
        selectUser(user) {
            this.editUser = {
                ...user,
                password: "",
                owner: Boolean(user.owner),
            };
            this.$root.getSocket().emit("adminGetUserAssignments", user.id, (res) => {
                if (res.ok) {
                    this.selectedAssignments = res.assignments.map((item) => `${item.endpoint || ""}:::${item.stackName}`);
                }
            });
        },
        saveUser() {
            this.$root.getSocket().emit("adminSaveUser", this.editUser, (res) => {
                this.$root.toastRes(res);
                if (!res.ok) {
                    return;
                }
                const userID = this.editUser.id || res.userID;
                const assignments = this.selectedAssignments.map((value) => {
                    const [ endpoint, stackName ] = value.split(":::");
                    return {
                        endpoint,
                        stackName,
                    };
                });
                this.$root.getSocket().emit("adminSetUserAssignments", userID, assignments, (assignRes) => {
                    this.$root.toastRes(assignRes);
                    if (assignRes.ok) {
                        this.loadUsers();
                    }
                });
            });
        },
        deleteUser() {
            this.$root.getSocket().emit("adminDeleteUser", this.editUser.id, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.newUser();
                    this.loadUsers();
                }
            });
        },
    },
};
</script>

<style scoped lang="scss">
.user-row {
    padding: 0.75rem;
    border-radius: 0.75rem;
    cursor: pointer;
}

.user-row.active,
.user-row:hover {
    background: rgba(0, 0, 0, 0.05);
}

.access-grid {
    max-height: 260px;
    overflow: auto;
}

.access-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.35rem 0;
}
</style>
