import os from "node:os";
import fs from "node:fs";
import childProcessAsync from "promisify-child-process";

export interface GPUInfo {
    name: string;
    vendor?: string;
    driverVersion?: string;
    memoryMB?: number;
    status?: string;
}

export interface SystemSpecs {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    cpuModel: string;
    cpuCores: number;
    totalMemoryBytes: number;
    gpus: GPUInfo[];
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpuModel: os.cpus()[0]?.model || "Unknown CPU",
        cpuCores: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
        gpus: await detectGPUs(),
    };
}

async function detectGPUs(): Promise<GPUInfo[]> {
    try {
        switch (os.platform()) {
            case "win32":
                return await detectWindowsGPUs();
            case "linux":
                return await detectLinuxGPUs();
            case "darwin":
                return await detectMacGPUs();
            default:
                return [];
        }
    } catch (e) {
        return [];
    }
}

async function detectWindowsGPUs(): Promise<GPUInfo[]> {
    const command = "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,DriverVersion,AdapterRAM,Status | ConvertTo-Json -Compress";
    const result = await childProcessAsync.spawn("powershell", [
        "-NoProfile",
        "-Command",
        command
    ], {
        encoding: "utf-8",
        timeout: 15000,
    });

    if (!result.stdout) {
        return [];
    }

    const parsed = JSON.parse(result.stdout.toString()) as Record<string, unknown> | Array<Record<string, unknown>>;
    const items = Array.isArray(parsed) ? parsed : [ parsed ];
    return items
        .filter((item) => item.Name)
        .map((item) => ({
            name: String(item.Name),
            vendor: item.AdapterCompatibility ? String(item.AdapterCompatibility) : undefined,
            driverVersion: item.DriverVersion ? String(item.DriverVersion) : undefined,
            memoryMB: typeof item.AdapterRAM === "number" ? Math.round(Number(item.AdapterRAM) / 1024 / 1024) : undefined,
            status: item.Status ? String(item.Status) : undefined,
        }));
}

async function detectLinuxGPUs(): Promise<GPUInfo[]> {
    const gpus: GPUInfo[] = [];

    try {
        const nvidia = await spawnFirstAvailable([
            "nvidia-smi",
            "/usr/bin/nvidia-smi",
            "/usr/local/nvidia/bin/nvidia-smi",
        ], [
            "--query-gpu=name,driver_version,memory.total",
            "--format=csv,noheader,nounits"
        ]);

        if (nvidia.stdout) {
            for (const line of nvidia.stdout.toString().split("\n")) {
                if (!line.trim()) {
                    continue;
                }
                const [ name, driverVersion, memoryMB ] = line.split(",").map((item) => item.trim());
                gpus.push({
                    name,
                    vendor: "NVIDIA",
                    driverVersion,
                    memoryMB: memoryMB ? Number(memoryMB) : undefined,
                });
            }
        }
    } catch (e) {
    }

    if (gpus.length > 0) {
        return gpus;
    }

    try {
        const procInfo = detectLinuxNvidiaFromProc();
        if (procInfo.length > 0) {
            return procInfo;
        }
    } catch (e) {
    }

    try {
        const drmInfo = detectLinuxGPUsFromDRM();
        if (drmInfo.length > 0) {
            return drmInfo;
        }
    } catch (e) {
    }

    try {
        const lspci = await spawnFirstAvailable([
            "lspci",
            "/usr/bin/lspci",
            "/sbin/lspci",
        ], []);
        if (!lspci.stdout) {
            return [];
        }

        return lspci.stdout.toString()
            .split("\n")
            .filter((line) => /(VGA compatible controller|3D controller|Display controller)/i.test(line))
            .map((line) => {
                const parts = line.split(": ");
                const name = parts.slice(1).join(": ").trim();
                return {
                    name: name || line.trim(),
                    vendor: inferVendor(name || line),
                };
            });
    } catch (e) {
        return [];
    }
}

async function detectMacGPUs(): Promise<GPUInfo[]> {
    const result = await childProcessAsync.spawn("system_profiler", [ "SPDisplaysDataType", "-json" ], {
        encoding: "utf-8",
        timeout: 15000,
    });

    if (!result.stdout) {
        return [];
    }

    const parsed = JSON.parse(result.stdout.toString()) as Record<string, Array<Record<string, unknown>>>;
    const items = parsed.SPDisplaysDataType || [];
    return items.map((item) => ({
        name: String(item.sppci_model || item._name || "GPU"),
        vendor: item.spdisplays_vendor ? String(item.spdisplays_vendor) : undefined,
        memoryMB: parseMacMemory(item.spdisplays_vram),
    }));
}

function parseMacMemory(value: unknown) {
    if (typeof value !== "string") {
        return undefined;
    }
    const match = value.match(/(\d+)/);
    return match ? Number(match[1]) : undefined;
}

function inferVendor(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes("nvidia")) {
        return "NVIDIA";
    }
    if (lower.includes("amd") || lower.includes("radeon") || lower.includes("ati")) {
        return "AMD";
    }
    if (lower.includes("intel")) {
        return "Intel";
    }
    if (lower.includes("microsoft")) {
        return "Microsoft";
    }
    if (lower.includes("vmware")) {
        return "VMware";
    }
    if (lower.includes("virtio")) {
        return "Virtio";
    }
    return undefined;
}

async function spawnFirstAvailable(commands: string[], args: string[]) {
    let lastError: unknown;

    for (const command of commands) {
        try {
            return await childProcessAsync.spawn(command, args, {
                encoding: "utf-8",
                timeout: 15000,
            });
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError;
}

function detectLinuxNvidiaFromProc(): GPUInfo[] {
    const basePath = "/proc/driver/nvidia/gpus";
    if (!fs.existsSync(basePath)) {
        return [];
    }

    const gpuDirs = fs.readdirSync(basePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

    return gpuDirs.map((dirName) => {
        const infoPath = `${basePath}/${dirName}/information`;
        const content = fs.existsSync(infoPath) ? fs.readFileSync(infoPath, "utf-8") : "";
        const lines = Object.fromEntries(content
            .split("\n")
            .map((line) => line.split(":").map((part) => part.trim()))
            .filter((parts) => parts.length >= 2)
            .map(([ key, ...rest ]) => [ key, rest.join(": ") ]));

        return {
            name: String(lines.Model || lines["GPU UUID"] || dirName),
            vendor: "NVIDIA",
            driverVersion: readLinuxNvidiaDriverVersion(),
        };
    });
}

function readLinuxNvidiaDriverVersion() {
    const versionPath = "/proc/driver/nvidia/version";
    if (!fs.existsSync(versionPath)) {
        return undefined;
    }

    const content = fs.readFileSync(versionPath, "utf-8");
    const match = content.match(/Kernel Module\s+(\S+)/i);
    return match ? match[1] : undefined;
}

function detectLinuxGPUsFromDRM(): GPUInfo[] {
    const drmPath = "/sys/class/drm";
    if (!fs.existsSync(drmPath)) {
        return [];
    }

    const cards = fs.readdirSync(drmPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^card\d+$/.test(entry.name))
        .map((entry) => entry.name);

    const seen = new Set<string>();
    const gpus: GPUInfo[] = [];

    for (const card of cards) {
        const devicePath = `${drmPath}/${card}/device`;
        if (!fs.existsSync(devicePath)) {
            continue;
        }

        const vendorID = safeReadTrim(`${devicePath}/vendor`);
        const driverName = resolveLinuxDriverName(devicePath);
        const vendor = inferVendorFromVendorID(vendorID) || inferVendor(driverName || "");
        const key = `${vendorID || "unknown"}:${driverName || card}`;

        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        gpus.push({
            name: describeLinuxGPU(vendor, driverName, card),
            vendor: vendor || undefined,
            driverVersion: readLinuxModuleVersion(driverName),
        });
    }

    return gpus;
}

function safeReadTrim(filePath: string) {
    if (!fs.existsSync(filePath)) {
        return "";
    }

    return fs.readFileSync(filePath, "utf-8").trim();
}

function resolveLinuxDriverName(devicePath: string) {
    const driverPath = `${devicePath}/driver`;
    try {
        if (fs.existsSync(driverPath)) {
            return fs.realpathSync(driverPath).split("/").pop() || "";
        }
    } catch (e) {
    }

    return safeReadTrim(`${devicePath}/uevent`)
        .split("\n")
        .find((line) => line.startsWith("DRIVER="))
        ?.replace(/^DRIVER=/, "") || "";
}

function inferVendorFromVendorID(vendorID: string) {
    switch (vendorID.toLowerCase()) {
        case "0x10de":
            return "NVIDIA";
        case "0x8086":
            return "Intel";
        case "0x1002":
        case "0x1022":
            return "AMD";
        default:
            return undefined;
    }
}

function describeLinuxGPU(vendor?: string, driverName?: string, cardName?: string) {
    if (vendor && driverName) {
        return `${vendor} GPU (${driverName})`;
    }
    if (vendor) {
        return `${vendor} GPU${cardName ? ` (${cardName})` : ""}`;
    }
    if (driverName) {
        return `GPU (${driverName})`;
    }
    return cardName || "GPU";
}

function readLinuxModuleVersion(driverName?: string) {
    if (!driverName) {
        return undefined;
    }

    const version = safeReadTrim(`/sys/module/${driverName}/version`);
    return version || undefined;
}
