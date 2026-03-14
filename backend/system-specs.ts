import os from "node:os";
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
        const nvidia = await childProcessAsync.spawn("nvidia-smi", [
            "--query-gpu=name,driver_version,memory.total",
            "--format=csv,noheader,nounits"
        ], {
            encoding: "utf-8",
            timeout: 15000,
        });

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
        const lspci = await childProcessAsync.spawn("lspci", [], {
            encoding: "utf-8",
            timeout: 15000,
        });
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
