import path from "path";
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

    return {
        file: "docker",
        args: dockerArgs,
        cwd,
    };
}

export async function spawnDocker(server: DockgeServer, dockerArgs: string[], cwd?: string, extraOptions: Record<string, unknown> = {}) {
    const command = await buildDockerCommand(server, dockerArgs, cwd);
    return await childProcessAsync.spawn(command.file, command.args, {
        cwd: command.cwd,
        ...extraOptions,
    });
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
