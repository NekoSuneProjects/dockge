import { ValidationError } from "./util-server";

export interface AppInstallRequest {
    stackName?: string;
    values?: Record<string, string>;
}

export interface AppCatalogItem {
    id: string;
    name: string;
    description: string;
    category: string;
    defaultStackName: string;
    ports?: string[];
    requiresAdmin?: boolean;
    values?: Array<{
        key: string;
        label: string;
        defaultValue: string;
        description?: string;
    }>;
    composeTemplate: string;
    envTemplate?: string;
}

const appCatalog: AppCatalogItem[] = [
    {
        id: "ollama",
        name: "Ollama",
        description: "Run local LLM inference with persistent models storage.",
        category: "AI",
        defaultStackName: "ollama",
        ports: [ "11434" ],
        values: [
            {
                key: "OLLAMA_PORT",
                label: "Ollama Port",
                defaultValue: "11434",
                description: "Host port exposed for the Ollama API."
            }
        ],
        composeTemplate: `services:
  ollama:
    image: ollama/ollama:latest
    container_name: {{STACK_NAME}}
    restart: unless-stopped
    ports:
      - "{{OLLAMA_PORT}}:11434"
    volumes:
      - ./ollama:/root/.ollama
`,
    },
    {
        id: "open-webui",
        name: "Open WebUI",
        description: "Web UI for local AI models and Ollama-compatible APIs.",
        category: "AI",
        defaultStackName: "open-webui",
        ports: [ "3000" ],
        values: [
            {
                key: "OPENWEBUI_PORT",
                label: "Web Port",
                defaultValue: "3000"
            },
            {
                key: "OLLAMA_BASE_URL",
                label: "Ollama Base URL",
                defaultValue: "http://host.docker.internal:11434"
            }
        ],
        composeTemplate: `services:
  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: {{STACK_NAME}}
    restart: unless-stopped
    ports:
      - "{{OPENWEBUI_PORT}}:8080"
    environment:
      - OLLAMA_BASE_URL={{OLLAMA_BASE_URL}}
    volumes:
      - ./data:/app/backend/data
`,
    },
    {
        id: "uptime-kuma",
        name: "Uptime Kuma",
        description: "Monitoring and status dashboard.",
        category: "Monitoring",
        defaultStackName: "uptime-kuma",
        ports: [ "3001" ],
        composeTemplate: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: {{STACK_NAME}}
    restart: always
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
`,
    },
    {
        id: "mariadb",
        name: "MariaDB",
        description: "Simple database install with persistent data.",
        category: "Database",
        defaultStackName: "mariadb",
        ports: [ "3306" ],
        values: [
            {
                key: "MARIADB_ROOT_PASSWORD",
                label: "Root Password",
                defaultValue: "ChangeMe123!"
            }
        ],
        composeTemplate: `services:
  mariadb:
    image: mariadb:latest
    container_name: {{STACK_NAME}}
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      - MARIADB_ROOT_PASSWORD={{MARIADB_ROOT_PASSWORD}}
    volumes:
      - ./data:/var/lib/mysql
`,
    }
];

export function getAppCatalog() {
    return appCatalog.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        defaultStackName: item.defaultStackName,
        ports: item.ports || [],
        values: item.values || [],
    }));
}

export function buildAppInstall(appID: string, request: AppInstallRequest) {
    const app = appCatalog.find((item) => item.id === appID);
    if (!app) {
        throw new ValidationError("App template not found");
    }

    const stackName = String(request.stackName || app.defaultStackName).trim().toLowerCase();
    if (!stackName) {
        throw new ValidationError("Stack name is required");
    }

    const values: Record<string, string> = {
        STACK_NAME: stackName,
    };

    for (const entry of app.values || []) {
        values[entry.key] = String(request.values?.[entry.key] || entry.defaultValue || "");
    }

    return {
        stackName,
        composeYAML: applyTemplate(app.composeTemplate, values),
        composeENV: app.envTemplate ? applyTemplate(app.envTemplate, values) : "",
        app,
    };
}

function applyTemplate(template: string, values: Record<string, string>) {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => {
        return values[key] ?? "";
    });
}
