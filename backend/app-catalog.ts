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
    extraFiles?: Array<{
        path: string;
        template: string;
    }>;
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
                description: "Host port exposed for the Ollama API.",
            },
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
                defaultValue: "3000",
            },
            {
                key: "OLLAMA_BASE_URL",
                label: "Ollama Base URL",
                defaultValue: "http://host.docker.internal:11434",
            },
            {
                key: "ENABLE_SIGNUP",
                label: "Enable Signup",
                defaultValue: "true",
            },
            {
                key: "DEFAULT_USER_ROLE",
                label: "Default User Role",
                defaultValue: "pending",
            },
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
      - ENABLE_SIGNUP={{ENABLE_SIGNUP}}
      - ENABLE_SIGNUP_PASSWORD_CONFIRMATION=true
      - ENABLE_LOGIN_FORM=true
      - DEFAULT_USER_ROLE={{DEFAULT_USER_ROLE}}
      - ENABLE_CODE_EXECUTION=true
      - CODE_EXECUTION_ENGINE=pyodide
      - ENABLE_CODE_INTERPRETER=true
      - CODE_INTERPRETER_ENGINE=pyodide
      - ENABLE_DIRECT_CONNECTIONS=false
      - ENABLE_COMMUNITY_SHARING=true
      - ENABLE_API_KEYS=true
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
                defaultValue: "ChangeMe123!",
            },
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
    },
    {
        id: "minio",
        name: "MinIO",
        description: "S3-compatible object storage with console UI.",
        category: "Storage",
        defaultStackName: "minio",
        ports: [ "9000", "9001" ],
        values: [
            {
                key: "MINIO_ROOT_USER",
                label: "Root User",
                defaultValue: "minioadmin",
            },
            {
                key: "MINIO_ROOT_PASSWORD",
                label: "Root Password",
                defaultValue: "ChangeMe123!",
            },
        ],
        composeTemplate: `version: "3.3"
services:
  minio:
    image: quay.io/minio/minio:RELEASE.2025-02-28T09-55-16Z
    container_name: minio
    network_mode: host
    ports:
      - 9000:9000
      - 9001:9001
    volumes:
      - ./data:/data
    environment:
      - MINIO_ROOT_USER={{MINIO_ROOT_USER}}
      - MINIO_ROOT_PASSWORD={{MINIO_ROOT_PASSWORD}}
    command: server /data --address ":9000" --console-address ":9001"
networks: {}
`,
    },
    {
        id: "nextcloud",
        name: "Nextcloud",
        description: "Personal cloud with external app, config, and data mounts.",
        category: "Productivity",
        defaultStackName: "nextcloud",
        ports: [ "80" ],
        values: [
            {
                key: "NEXTCLOUD_URL",
                label: "Nextcloud URL",
                defaultValue: "https://cloud.example.com",
            },
            {
                key: "JWT_SECRET_KEY",
                label: "JWT Secret Key",
                defaultValue: "ChangeMeJWTSecret",
            },
            {
                key: "PUID",
                label: "PUID",
                defaultValue: "1000",
            },
            {
                key: "PGID",
                label: "PGID",
                defaultValue: "1000",
            },
            {
                key: "TZ",
                label: "Timezone",
                defaultValue: "Europe/London",
            },
        ],
        composeTemplate: `services:
  nextcloud:
    image: nextcloud
    container_name: nextcloud
    volumes:
      - ./nextcloud/nextcloud:/var/www/html
      - ./nextcloud/apps:/var/www/html/custom_apps
      - ./nextcloud/config:/var/www/html/config
      - ./data:/var/www/html/data
      - ./nextcloud/theme:/var/www/html/themes
      - /usr/local/bin/yt-dlp:/usr/local/bin/yt-dlp:ro
      - /usr/bin/aria2c:/usr/bin/aria2c:ro
      - /usr/bin/ffmpeg:/usr/bin/ffmpeg:ro
    env_file:
      - .env
    ports:
      - 80:80
`,
        envTemplate: `NEXTCLOUD_URL={{NEXTCLOUD_URL}}
JWT_SECRET_KEY={{JWT_SECRET_KEY}}
PUID={{PUID}}
PGID={{PGID}}
TZ={{TZ}}
`,
    },
    {
        id: "media-node",
        name: "Media Node",
        description: "Plex and Jellyfin media stack with host networking and GPU device mounts.",
        category: "Media",
        defaultStackName: "media-node",
        ports: [ "32400", "8096" ],
        values: [
            {
                key: "PLEX_CLAIM",
                label: "Plex Claim",
                defaultValue: "",
            },
            {
                key: "JELLYFIN_SERVER_ADDRESS",
                label: "Jellyfin Server Address",
                defaultValue: "http://127.0.0.1:8096",
            },
            {
                key: "JELLYFIN_PUBLISHED_SERVER_URL",
                label: "Jellyfin Published URL",
                defaultValue: "https://domain.com",
            },
            {
                key: "JELLYFIN_AUTHENTICATION_USERNAME",
                label: "Jellyfin Username",
                defaultValue: "",
            },
            {
                key: "JELLYFIN_AUTHENTICATION_PASSWORD",
                label: "Jellyfin Password",
                defaultValue: "",
            },
            {
                key: "PUID",
                label: "PUID",
                defaultValue: "1000",
            },
            {
                key: "PGID",
                label: "PGID",
                defaultValue: "1000",
            },
            {
                key: "UMASK",
                label: "UMASK",
                defaultValue: "002",
            },
            {
                key: "TZ",
                label: "Timezone",
                defaultValue: "Europe/London",
            },
        ],
        composeTemplate: `services:
  pms-docker:
    image: linuxserver/plex
    container_name: plex
    network_mode: host
    env_file:
      - .env
    devices:
      - /dev/dri/renderD128:/dev/dri/renderD128
      - /dev/dri/card0:/dev/dri/card0
      - /dev/dri/card1:/dev/dri/card1
    volumes:
      - ./config/plex:/config
      - ./data/plex/transcode/temp:/transcode
      - ./media/data:/data

  jellyfin:
    image: jellyfin/jellyfin
    container_name: jellyfin
    user: root
    network_mode: host
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./config/jellyfin:/config
      - ./metadata:/config/metadata
      - ./data/jellyfin/cache:/cache
      - ./media/data/movies:/movies
      - ./media/data/tvs:/tvs
      - ./media/data/books:/books
      - ./media/data/musics:/musics
      - ./media/data/anime:/anime
      - type: bind
        source: ./data/jellyfin/fonts
        target: /usr/local/share/fonts/custom
        read_only: true
    devices:
      - /dev/dri/renderD128:/dev/dri/renderD128
      - /dev/dri/card0:/dev/dri/card0
      - /dev/dri/card1:/dev/dri/card1
    extra_hosts:
      - host.docker.internal:host-gateway
`,
        envTemplate: `PLEX_CLAIM={{PLEX_CLAIM}}
JELLYFIN_SERVER_ADDRESS={{JELLYFIN_SERVER_ADDRESS}}
JELLYFIN_PublishedServerUrl={{JELLYFIN_PUBLISHED_SERVER_URL}}
JELLYFIN_AUTHENTICATION_USERNAME={{JELLYFIN_AUTHENTICATION_USERNAME}}
JELLYFIN_AUTHENTICATION_PASSWORD={{JELLYFIN_AUTHENTICATION_PASSWORD}}
PUID={{PUID}}
PGID={{PGID}}
UMASK={{UMASK}}
TZ={{TZ}}
`,
    },
    {
        id: "adguard-home",
        name: "AdGuard Home",
        description: "DNS and ad-blocking service with host networking.",
        category: "Network",
        defaultStackName: "adguard-home",
        ports: [ "53", "3000" ],
        composeTemplate: `services:
  adguardhome:
    image: adguard/adguardhome
    container_name: adguardhome
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./work:/opt/adguardhome/work
      - ./conf:/opt/adguardhome/conf
`,
    },
    {
        id: "speedtest-tracker",
        name: "Speedtest Tracker",
        description: "Network speed history dashboard with configurable schedule.",
        category: "Monitoring",
        defaultStackName: "speedtest-tracker",
        ports: [ "8660", "8643" ],
        values: [
            {
                key: "PUID",
                label: "PUID",
                defaultValue: "1000",
            },
            {
                key: "PGID",
                label: "PGID",
                defaultValue: "1000",
            },
            {
                key: "APP_KEY",
                label: "App Key",
                defaultValue: "base64:replace-me",
            },
            {
                key: "DISPLAY_TIMEZONE",
                label: "Display Timezone",
                defaultValue: "Europe/London",
            },
            {
                key: "SPEEDTEST_SCHEDULE",
                label: "Schedule",
                defaultValue: "*/5 * * * *",
            },
        ],
        composeTemplate: `services:
  speedtest-tracker:
    image: lscr.io/linuxserver/speedtest-tracker:latest
    container_name: speedtest-tracker
    restart: unless-stopped
    ports:
      - 8660:80
      - 8643:443
    env_file:
      - .env
    volumes:
      - ./data:/config
      - ./ssl:/config/keys
`,
        envTemplate: `PUID={{PUID}}
PGID={{PGID}}
APP_KEY={{APP_KEY}}
DB_CONNECTION=sqlite
PUBLIC_DASHBOARD=true
DISPLAY_TIMEZONE={{DISPLAY_TIMEZONE}}
SPEEDTEST_SCHEDULE={{SPEEDTEST_SCHEDULE}}
API_RATE_LIMIT=150
`,
    },
    {
        id: "flaresolverr",
        name: "FlareSolverr",
        description: "Cloudflare challenge solver service.",
        category: "Utility",
        defaultStackName: "flaresolverr",
        ports: [ "8191" ],
        composeTemplate: `services:
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    restart: unless-stopped
    ports:
      - 8191:8191
    environment:
      - LOG_LEVEL=info
networks: {}
`,
    },
    {
        id: "ipfs",
        name: "IPFS",
        description: "IPFS Kubo node with local persistent datastore.",
        category: "Storage",
        defaultStackName: "ipfs",
        ports: [ "4001", "5001", "8080" ],
        composeTemplate: `version: "3.3"
services:
  ipfs:
    image: ipfs/kubo:v0.30.0
    container_name: ipfs
    restart: unless-stopped
    volumes:
      - ./ipfs:/data/ipfs
    ports:
      - 4001:4001
      - 5001:5001
      - 8080:8080
`,
    },
    {
        id: "nginx-proxy-manager",
        name: "Nginx Proxy Manager",
        description: "Reverse proxy manager with bundled MariaDB backend.",
        category: "Network",
        defaultStackName: "nginx-proxy-manager",
        ports: [ "80", "81", "443" ],
        values: [
            {
                key: "DB_MYSQL_PASSWORD",
                label: "DB Password",
                defaultValue: "npm",
            },
            {
                key: "MYSQL_ROOT_PASSWORD",
                label: "DB Root Password",
                defaultValue: "npm",
            },
            {
                key: "DISABLE_IPV6",
                label: "Disable IPv6",
                defaultValue: "false",
            },
        ],
        composeTemplate: `services:
  app:
    image: jc21/nginx-proxy-manager:2.13.5
    restart: unless-stopped
    tty: true
    stdin_open: true
    ports:
      - 80:80
      - 443:443
      - 81:81
    env_file:
      - .env
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    depends_on:
      - db

  db:
    image: jc21/mariadb-aria:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./mysql:/var/lib/mysql
`,
        envTemplate: `DB_MYSQL_HOST=db
DB_MYSQL_PORT=3306
DB_MYSQL_USER=npm
DB_MYSQL_PASSWORD={{DB_MYSQL_PASSWORD}}
DB_MYSQL_NAME=npm
DISABLE_IPV6={{DISABLE_IPV6}}
MYSQL_ROOT_PASSWORD={{MYSQL_ROOT_PASSWORD}}
MYSQL_DATABASE=npm
MYSQL_USER=npm
MYSQL_PASSWORD={{DB_MYSQL_PASSWORD}}
MARIADB_AUTO_UPGRADE=1
`,
    },
    {
        id: "nostr-relay",
        name: "Nostr Relay",
        description: "nostr-rs-relay with generated starter config.toml.",
        category: "Web3",
        defaultStackName: "nostr-relay",
        ports: [ "8080" ],
        values: [
            {
                key: "NOSTR_RELAY_URL",
                label: "Relay URL",
                defaultValue: "wss://domain.com/nostr",
            },
            {
                key: "NOSTR_RELAY_NAME",
                label: "Relay Name",
                defaultValue: "nostr-rs-relay",
            },
            {
                key: "NOSTR_RELAY_DESCRIPTION",
                label: "Relay Description",
                defaultValue: "Public Nostr relay behind Nginx Proxy Manager with real IP passthrough.",
            },
        ],
        composeTemplate: `services:
  nostr-rs-relay:
    image: scsibug/nostr-rs-relay:latest
    stdin_open: true
    tty: true
    ports:
      - 8080:8080
    volumes:
      - ./config.toml:/usr/src/app/config.toml
      - ./data:/usr/src/app/db
`,
        extraFiles: [
            {
                path: "config.toml",
                template: `# =========================
# Nostr-rs-relay configuration
# =========================

[info]
relay_url = "{{NOSTR_RELAY_URL}}"
name = "{{NOSTR_RELAY_NAME}}"
description = "{{NOSTR_RELAY_DESCRIPTION}}"

[database]
engine = "sqlite"
data_directory = "/usr/src/app/db"

[network]
address = "0.0.0.0"
port = 8080
remote_ip_header = "x-forwarded-for"
ping_interval = 300

[options]
reject_future_seconds = 1800

[limits]
messages_per_sec = 5
subscriptions_per_min = 10
max_event_bytes = 131072
max_ws_message_bytes = 131072
max_ws_frame_bytes = 131072
broadcast_buffer = 16384
event_persist_buffer = 4096
`,
            },
        ],
    },
    {
        id: "searxng",
        name: "SearXNG",
        description: "Metasearch engine with local config volume.",
        category: "Search",
        defaultStackName: "searxng",
        ports: [ "8080" ],
        values: [
            {
                key: "INSTANCE_NAME",
                label: "Instance Name",
                defaultValue: "searxng-in",
            },
        ],
        composeTemplate: `services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - 8080:8080
    volumes:
      - ./searxng:/etc/searxng
    environment:
      - INSTANCE_NAME={{INSTANCE_NAME}}
`,
    },
    {
        id: "litellm",
        name: "LiteLLM",
        description: "LLM gateway with generated config.yaml and .env.",
        category: "AI",
        defaultStackName: "litellm",
        ports: [ "4000" ],
        values: [
            {
                key: "PROXY_BASE_URL",
                label: "Proxy Base URL",
                defaultValue: "https://domain.com",
            },
            {
                key: "LITELLM_MASTER_KEY",
                label: "Master Key",
                defaultValue: "sk-gen",
            },
            {
                key: "LITELLM_SALT_KEY",
                label: "Salt Key",
                defaultValue: "sk-gen",
            },
            {
                key: "DATABASE_URL",
                label: "Database URL",
                defaultValue: "postgresql://user:pass@127.0.0.1:5432/litellm",
            },
            {
                key: "SMTP_HOST",
                label: "SMTP Host",
                defaultValue: "mail.domain.com",
            },
            {
                key: "SMTP_USERNAME",
                label: "SMTP Username",
                defaultValue: "no-reply@domain.com",
            },
            {
                key: "SMTP_PASSWORD",
                label: "SMTP Password",
                defaultValue: "pass",
            },
            {
                key: "SMTP_SENDER_EMAIL",
                label: "SMTP Sender",
                defaultValue: "no-reply@domain.com",
            },
        ],
        composeTemplate: `services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    container_name: litellm
    volumes:
      - ./litellm/config.yaml:/app/config.yaml
    command:
      - --config=/app/config.yaml
    ports:
      - 4000:4000
    env_file:
      - .env
    healthcheck:
      test:
        - CMD
        - curl
        - -f
        - http://localhost:4000/health/liveliness || exit 1
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
`,
        envTemplate: `PROXY_BASE_URL={{PROXY_BASE_URL}}
LITELLM_MASTER_KEY={{LITELLM_MASTER_KEY}}
LITELLM_SALT_KEY={{LITELLM_SALT_KEY}}
STORE_MODEL_IN_DB=True
DATABASE_URL={{DATABASE_URL}}
SMTP_HOST={{SMTP_HOST}}
SMTP_USERNAME={{SMTP_USERNAME}}
SMTP_PASSWORD={{SMTP_PASSWORD}}
SMTP_SENDER_EMAIL={{SMTP_SENDER_EMAIL}}
SMTP_TLS=True
SMTP_PORT=587
`,
        extraFiles: [
            {
                path: "litellm/config.yaml",
                template: `model_list: []

litellm_settings:
  drop_params: true
  callbacks: ["smtp_email"]

general_settings: {}
`,
            },
        ],
    },
    {
        id: "restreamer",
        name: "Restreamer",
        description: "Video restreaming node with host-exposed ingest ports.",
        category: "Media",
        defaultStackName: "restreamer",
        ports: [ "8080", "8181", "1935", "1936", "6000/udp" ],
        composeTemplate: `version: "3.3"
services:
  restreamer:
    image: datarhei/restreamer:latest
    container_name: restreamer
    restart: always
    volumes:
      - ./restreamer/config:/core/config
      - ./restreamer/data:/core/data
    ports:
      - 8080:8080
      - 8181:8181
      - 1935:1935
      - 1936:1936
      - 6000:6000/udp
networks: {}
`,
    },
    {
        id: "postgres",
        name: "Postgres",
        description: "Postgres 17 with persistent data and logs.",
        category: "Database",
        defaultStackName: "postgres",
        ports: [ "5432" ],
        values: [
            {
                key: "POSTGRES_USER",
                label: "Postgres User",
                defaultValue: "root",
            },
            {
                key: "POSTGRES_PASSWORD",
                label: "Postgres Password",
                defaultValue: "ChangeMe123!",
            },
        ],
        composeTemplate: `services:
  postgres:
    image: postgres:17-alpine
    container_name: progressdefault
    mem_limit: 256m
    memswap_limit: 512m
    mem_reservation: 256m
    env_file:
      - .env
    ports:
      - 5432:5432
    volumes:
      - ./postgres/db:/var/lib/postgresql/data
      - ./postgres/log:/var/lib/postgresql/data/log
    restart: always
`,
        envTemplate: `POSTGRES_USER={{POSTGRES_USER}}
POSTGRES_PASSWORD={{POSTGRES_PASSWORD}}
`,
    },
    {
        id: "redis-stack",
        name: "Redis Stack",
        description: "Valkey/Redis-style service with password and config file mount.",
        category: "Database",
        defaultStackName: "redis-stack",
        ports: [ "6379" ],
        values: [
            {
                key: "REDIS_HOST_PASSWORD",
                label: "Redis Password",
                defaultValue: "ChangeMe123!",
            },
        ],
        composeTemplate: `services:
  redis-stack-server:
    image: valkey/valkey:alpine
    container_name: redis-stack-server
    restart: always
    mem_limit: 128m
    memswap_limit: 256m
    mem_reservation: 128m
    env_file:
      - .env
    ports:
      - 6379:6379
    command: |
      --requirepass "{{REDIS_HOST_PASSWORD}}"
    volumes:
      - ./redis/conf/redis-stack.conf:/etc/redis-stack.conf
`,
        envTemplate: `REDIS_HOST_PASSWORD={{REDIS_HOST_PASSWORD}}
`,
        extraFiles: [
            {
                path: "redis/conf/redis-stack.conf",
                template: `port 6379
daemonize no
loadmodule /opt/redis-stack/lib/rediscompat.so
loadmodule /opt/redis-stack/lib/redisearch.so
loadmodule /opt/redis-stack/lib/redistimeseries.so
loadmodule /opt/redis-stack/lib/rejson.so
loadmodule /opt/redis-stack/lib/redisbloom.so
loadmodule /opt/redis-stack/lib/redisgears.so v8-plugin-path /opt/redis-stack/lib/libredisgears_v8_plugin.so
`,
            },
        ],
    },
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
        extraFiles: (app.extraFiles || []).map((file) => ({
            path: file.path,
            content: applyTemplate(file.template, values),
        })),
        app,
    };
}

function applyTemplate(template: string, values: Record<string, string>) {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => {
        return values[key] ?? "";
    });
}
