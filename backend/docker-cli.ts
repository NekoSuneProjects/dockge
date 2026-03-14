import path from "path";
import fs from "fs";
import childProcessAsync from "promisify-child-process";
import { DockgeServer } from "./dockge-server";
import { Settings } from "./settings";
import { sync as commandExistsSync } from "command-exists";

export interface DockerExecutionSettings {
    mode: "native" | "wsl";
    wslDistro: string;
}

export interface DockerExecCommand {
    file: string;
    args: string[];
    cwd?: string;
}

const COMMON_DOCKER_BINARIES = [
    process.env.DOCKGE_DOCKER_PATH || "",
    "docker",
    "/usr/bin/docker",
    "/usr/local/bin/docker",
];

export async function getDockerExecutionSettings(server: DockgeServer): Promise<DockerExecutionSettings> {
    const mode = await Settings.get("dockerExecutionMode");
    const wslDistro = await Settings.get("dockerWslDistro");

    if (process.platform === "win32" && mode === "wsl") {
        return {
            mode: "wsl",
            wslDistro: String(wslDistro || ""),
        };
    }

    return {
        mode: "native",
        wslDistro: String(wslDistro || ""),
    };
}

export async function buildDockerCommand(server: DockgeServer, dockerArgs: string[], cwd?: string): Promise<DockerExecCommand> {
    const settings = await getDockerExecutionSettings(server);

    if (settings.mode === "wsl" && process.platform === "win32") {
        const args: string[] = [];
        if (settings.wslDistro) {
            args.push("-d", settings.wslDistro);
        }

        if (cwd) {
            args.push("--cd", toWslPath(path.resolve(cwd)));
        }

        args.push("--", "docker", ...dockerArgs);

        return {
            file: "wsl.exe",
            args,
        };
    }

    const dockerBinary = resolveDockerBinary();

    return {
        file: dockerBinary,
        args: dockerArgs,
        cwd,
    };
}

export async function spawnDocker(server: DockgeServer, dockerArgs: string[], cwd?: string, extraOptions: Record<string, unknown> = {}) {
    const command = await buildDockerCommand(server, dockerArgs, cwd);
    try {
        return await childProcessAsync.spawn(command.file, command.args, {
            cwd: command.cwd,
            ...extraOptions,
        });
    } catch (e) {
        if (e instanceof Error && "code" in e && e.code === "ENOENT") {
            throw new Error("Docker CLI was not found inside the Dockge runtime. Rebuild or update the image, or set DOCKGE_DOCKER_PATH to the docker binary.");
        }
        throw e;
    }
}

export function toWslPath(inputPath: string) {
    const normalized = path.resolve(inputPath).replace(/\\/g, "/");
    const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
    if (!match) {
        return normalized;
    }
    return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

export async function buildDockerConsoleCommand(server: DockgeServer): Promise<DockerExecCommand> {
    const settings = await getDockerExecutionSettings(server);

    if (settings.mode === "wsl" && process.platform === "win32") {
        const args: string[] = [];
        if (settings.wslDistro) {
            args.push("-d", settings.wslDistro);
        }
        args.push("--cd", toWslPath(server.stackDirFullPath), "--", "bash", "-l");
        return {
            file: "wsl.exe",
            args,
        };
    }

    if (process.platform === "win32") {
        return {
            file: commandExistsSync("pwsh.exe") ? "pwsh.exe" : "powershell.exe",
            args: [],
            cwd: server.stacksDir,
        };
    }

    return {
        file: "bash",
        args: [],
        cwd: server.stacksDir,
    };
}

function resolveDockerBinary() {
    for (const candidate of COMMON_DOCKER_BINARIES) {
        if (!candidate) {
            continue;
        }

        if (candidate === "docker") {
            if (commandExistsSync(candidate)) {
                return candidate;
            }
            continue;
        }

        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return "docker";
}
