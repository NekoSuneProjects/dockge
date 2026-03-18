<template>
    <div class="appearance-page">
        <div class="my-4">
            <label for="language" class="form-label">
                {{ $t("Language") }}
            </label>
            <select id="language" v-model="$root.language" class="form-select">
                <option
                    v-for="(lang, i) in $i18n.availableLocales"
                    :key="`Lang${i}`"
                    :value="lang"
                >
                    {{ $i18n.messages[lang].languageName }}
                </option>
            </select>
        </div>

        <div class="my-4">
            <label class="form-label">{{ $t("Theme") }}</label>
            <div class="btn-group" role="group" aria-label="Theme selector">
                <input
                    id="theme-light"
                    v-model="$root.userTheme"
                    type="radio"
                    class="btn-check"
                    name="theme"
                    autocomplete="off"
                    value="light"
                />
                <label class="btn btn-outline-primary" for="theme-light">
                    {{ $t("Light") }}
                </label>

                <input
                    id="theme-dark"
                    v-model="$root.userTheme"
                    type="radio"
                    class="btn-check"
                    name="theme"
                    autocomplete="off"
                    value="dark"
                />
                <label class="btn btn-outline-primary" for="theme-dark">
                    {{ $t("Dark") }}
                </label>

                <input
                    id="theme-auto"
                    v-model="$root.userTheme"
                    type="radio"
                    class="btn-check"
                    name="theme"
                    autocomplete="off"
                    value="auto"
                />
                <label class="btn btn-outline-primary" for="theme-auto">
                    {{ $t("Auto") }}
                </label>
            </div>
        </div>

        <div class="shadow-box big-padding css-card mt-4">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                    <h4 class="mb-1">Custom CSS</h4>
                    <div class="text-muted small">
                        This is saved in your browser for your own style only. It does not affect other users.
                    </div>
                </div>
                <div class="css-actions">
                    <button class="btn btn-normal" @click="loadExample">Load Example</button>
                    <button class="btn btn-primary" @click="saveCustomCSS">Save CSS</button>
                    <button class="btn btn-outline-danger" @click="resetCustomCSS">Reset Default CSS</button>
                </div>
            </div>

            <label class="form-label">Your CSS</label>
            <textarea
                v-model="customCSSDraft"
                class="form-control css-editor"
                spellcheck="false"
                placeholder="body { }"
            ></textarea>

            <div class="form-text mt-2">
                Use normal CSS selectors. Your current theme classes are on the page root, for example `.dark` and `.light`.
            </div>

            <div class="example-card mt-4">
                <div class="d-flex justify-content-between align-items-center gap-3 mb-2">
                    <strong>Example CSS</strong>
                    <button class="btn btn-sm btn-outline-secondary" @click="copyExample">Copy Example</button>
                </div>
                <pre class="example-code">{{ exampleCSS }}</pre>
            </div>
        </div>
    </div>
</template>

<script>
const EXAMPLE_CSS = `/* Make cards more glassy */
.shadow-box {
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
}

/* Change the top bar in dark mode */
.dark .navbar,
.dark header {
    background: linear-gradient(90deg, #101722 0%, #182332 100%);
}

/* Brighten primary buttons */
.btn-primary {
    background: linear-gradient(90deg, #38bdf8 0%, #22c55e 100%);
    border: none;
}

/* Make agent cards stand out */
.agent {
    padding: 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.03);
}`;

export default {
    data() {
        return {
            customCSSDraft: "",
            exampleCSS: EXAMPLE_CSS,
        };
    },

    mounted() {
        this.customCSSDraft = this.$root.customCSS || "";
    },

    methods: {
        saveCustomCSS() {
            this.$root.customCSS = this.customCSSDraft;
            this.$root.toastSuccess("Saved");
        },

        resetCustomCSS() {
            this.customCSSDraft = "";
            this.$root.customCSS = "";
            this.$root.toastSuccess("Saved");
        },

        loadExample() {
            this.customCSSDraft = EXAMPLE_CSS;
        },

        async copyExample() {
            try {
                await navigator.clipboard.writeText(EXAMPLE_CSS);
                this.$root.toastSuccess("Example CSS copied.");
            } catch (error) {
                this.$root.toastError("Failed to copy example CSS.");
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../styles/vars.scss";

.appearance-page {
    padding-bottom: 1rem;
}

.btn-check:active + .btn-outline-primary,
.btn-check:checked + .btn-outline-primary,
.btn-check:hover + .btn-outline-primary {
    color: #fff;

    .dark & {
        color: #000;
    }
}

.css-card {
    border-radius: 1.1rem;
}

.css-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.css-editor {
    min-height: 320px;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
    line-height: 1.5;
}

.example-card {
    border-radius: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
}

.example-code {
    margin: 0;
    white-space: pre-wrap;
    font-family: "JetBrains Mono", monospace;
    font-size: 12.5px;
    line-height: 1.55;
}

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }
}
</style>
