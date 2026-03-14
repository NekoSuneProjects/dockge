import { AgentSocketHandler } from "../agent-socket-handler";
import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { Stack } from "../stack";
import { AgentSocket } from "../../common/agent-socket";
import { requireAdmin, requireStackAccess } from "../auth";
import { promises as fsAsync } from "fs";
import path from "path";
import { buildAppInstall } from "../app-catalog";
import { getComposeTerminalName } from "../../common/util-common";
import { Terminal } from "../terminal";
import { getSystemSpecs } from "../system-specs";
import { spawnDocker } from "../docker-cli";

export class DockerSocketHandler extends AgentSocketHandler {
    create(socket : DockgeSocket, server : DockgeServer, agentSocket : AgentSocket) {
        // Do not call super.create()

        agentSocket.on("deployStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) === "string" && !Boolean(isAdd)) {
                    await requireStackAccess(socket, name, socket.endpoint);
                }
                const stack = await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                await stack.deploy(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deployed",
                    msgi18n: true,
                }, callback);
                stack.joinCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("saveStack", async (name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) === "string" && !Boolean(isAdd)) {
                    await requireStackAccess(socket, name, socket.endpoint);
                }
                await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                callbackResult({
                    ok: true,
                    msg: "Saved",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("installAppTemplate", async (appID : unknown, requestData : unknown, callback) => {
            try {
                checkLogin(socket);
                await requireAdmin(socket);

                if (typeof(appID) !== "string" || typeof(requestData) !== "object" || requestData === null) {
                    throw new ValidationError("Invalid app install request");
                }

                const install = buildAppInstall(appID, requestData as Record<string, string>);
                const stack = new Stack(server, install.stackName, install.composeYAML, install.composeENV, false);
                await stack.save(true);
                await stack.deploy(socket);
                server.sendStackList();

                callbackResult({
                    ok: true,
                    msg: `Installed ${install.app.name}.`,
                    stackName: install.stackName,
                }, callback);

                stack.joinCombinedTerminal(socket);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("deleteStack", async (name : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(name) !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                await requireStackAccess(socket, name, socket.endpoint);
                const stack = await Stack.getStack(server, name);

                try {
                    await stack.delete(socket);
                } catch (e) {
                    server.sendStackList();
                    throw e;
                }

                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Deleted",
                    msgi18n: true,
                }, callback);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("getStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);

                if (stack.isManagedByDockge) {
                    stack.joinCombinedTerminal(socket);
                }

                callbackResult({
                    ok: true,
                    stack: await stack.toJSON(socket.endpoint),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // requestStackList
        agentSocket.on("requestStackList", async (callback) => {
            try {
                checkLogin(socket);
                server.sendStackList();
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("cancelStackOperation", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }

                await requireStackAccess(socket, stackName, socket.endpoint);

                const terminalName = getComposeTerminalName(socket.endpoint, stackName);
                const cancelled = Terminal.cancel(terminalName);

                if (!cancelled) {
                    throw new ValidationError("No running stack operation found.");
                }

                callbackResult({
                    ok: true,
                    msg: "Operation cancelled.",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // startStack
        agentSocket.on("startStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);
                await stack.start(socket);
                callbackResult({
                    ok: true,
                    msg: "Started",
                    msgi18n: true,
                }, callback);
                server.sendStackList();

                stack.joinCombinedTerminal(socket);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        // stopStack
        agentSocket.on("stopStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);
                await stack.stop(socket);
                callbackResult({
                    ok: true,
                    msg: "Stopped",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // restartStack
        agentSocket.on("restartStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);
                await stack.restart(socket);
                callbackResult({
                    ok: true,
                    msg: "Restarted",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // updateStack
        agentSocket.on("updateStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);
                await stack.update(socket);
                callbackResult({
                    ok: true,
                    msg: "Updated",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackServiceAction", async (stackName : unknown, serviceName : unknown, action : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string" || typeof(serviceName) !== "string" || typeof(action) !== "string") {
                    throw new ValidationError("Invalid service action");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const allowedActions = new Set([ "start", "stop", "restart" ]);
                if (!allowedActions.has(action)) {
                    throw new ValidationError("Unsupported service action");
                }

                const stack = await Stack.getStack(server, stackName);
                await stack.serviceAction(socket, serviceName, action as "start" | "stop" | "restart");
                server.sendStackList();

                callbackResult({
                    ok: true,
                    msg: `Service ${action} completed.`,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("updateAllStacks", async (callback) => {
            try {
                checkLogin(socket);
                await requireAdmin(socket);

                const stackList = await Stack.getStackList(server, true);
                const results: Array<{ stackName: string, ok: boolean, error?: string }> = [];
                let updated = 0;
                let failed = 0;

                for (const [ stackName, stack ] of stackList) {
                    if (!stack.isManagedByDockge) {
                        continue;
                    }

                    try {
                        await stack.update(socket);
                        updated += 1;
                        results.push({
                            stackName,
                            ok: true,
                        });
                    } catch (e) {
                        failed += 1;
                        results.push({
                            stackName,
                            ok: false,
                            error: e instanceof Error ? e.message : "Unknown error",
                        });
                    }
                }

                server.sendStackList();
                callbackResult({
                    ok: failed === 0,
                    msg: failed === 0 ? `Updated ${updated} stack(s).` : `Updated ${updated} stack(s), ${failed} failed.`,
                    updated,
                    failed,
                    results,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // down stack
        agentSocket.on("downStack", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName);
                await stack.down(socket);
                callbackResult({
                    ok: true,
                    msg: "Downed",
                    msgi18n: true,
                }, callback);
                server.sendStackList();
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Services status
        agentSocket.on("serviceStatusList", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName, true);
                const serviceStatusList = Object.fromEntries(await stack.getServiceStatusList());
                callbackResult({
                    ok: true,
                    serviceStatusList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackResourceStats", async (stackName : unknown, callback) => {
            try {
                checkLogin(socket);

                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);

                const stack = await Stack.getStack(server, stackName, true);
                callbackResult({
                    ok: true,
                    stats: Object.fromEntries(await stack.getResourceStatsList()),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // getExternalNetworkList
        agentSocket.on("getDockerNetworkList", async (callback) => {
            try {
                checkLogin(socket);
                const dockerNetworkList = await server.getDockerNetworkList();
                callbackResult({
                    ok: true,
                    dockerNetworkList,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("systemSpecs", async (callback) => {
            try {
                checkLogin(socket);
                callbackResult({
                    ok: true,
                    specs: await getSystemSpecs(),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("dockerImageList", async (callback) => {
            try {
                await requireAdmin(socket);
                callbackResult({
                    ok: true,
                    images: await this.getDockerImages(server),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("pruneUnusedImages", async (callback) => {
            try {
                await requireAdmin(socket);
                await spawnDocker(server, [ "image", "prune", "-a", "-f" ], undefined, {
                    encoding: "utf-8",
                });
                callbackResult({
                    ok: true,
                    msg: "Unused images removed.",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("removeDockerImage", async (imageID : unknown, callback) => {
            try {
                await requireAdmin(socket);
                if (typeof(imageID) !== "string") {
                    throw new ValidationError("Image ID must be a string");
                }
                await spawnDocker(server, [ "image", "rm", imageID ], undefined, {
                    encoding: "utf-8",
                });
                callbackResult({
                    ok: true,
                    msg: "Image removed.",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("dockerContainerList", async (callback) => {
            try {
                await requireAdmin(socket);
                const res = await spawnDocker(server, [ "ps", "-a", "--format", "{{json .}}" ], undefined, {
                    encoding: "utf-8",
                });
                const containers = (res.stdout?.toString() || "")
                    .split("\n")
                    .filter((line) => line.trim())
                    .map((line) => JSON.parse(line) as Record<string, string>);
                callbackResult({
                    ok: true,
                    containers,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("dockerContainerAction", async (containerID : unknown, action : unknown, callback) => {
            try {
                await requireAdmin(socket);
                if (typeof(containerID) !== "string" || typeof(action) !== "string") {
                    throw new ValidationError("Invalid container action");
                }
                const allowedActions = new Set([ "start", "stop", "restart", "rm" ]);
                if (!allowedActions.has(action)) {
                    throw new ValidationError("Unsupported container action");
                }
                await spawnDocker(server, [ action, containerID ], undefined, {
                    encoding: "utf-8",
                });
                callbackResult({
                    ok: true,
                    msg: "Container action completed.",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileList", async (stackName : unknown, relativePath : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string") {
                    throw new ValidationError("Stack name must be a string");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const targetPath = this.resolveStackFilePath(stack, typeof relativePath === "string" ? relativePath : "");
                const entries = await fsAsync.readdir(targetPath, { withFileTypes: true });
                callbackResult({
                    ok: true,
                    cwd: path.relative(stack.fullPath, targetPath).replace(/\\/g, "/"),
                    files: entries.map((entry) => ({
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                    })).sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileRead", async (stackName : unknown, relativePath : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string" || typeof(relativePath) !== "string") {
                    throw new ValidationError("Invalid file request");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const targetPath = this.resolveStackFilePath(stack, relativePath);
                callbackResult({
                    ok: true,
                    content: await fsAsync.readFile(targetPath, "utf-8"),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileWrite", async (stackName : unknown, relativePath : unknown, content : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string" || typeof(relativePath) !== "string" || typeof(content) !== "string") {
                    throw new ValidationError("Invalid file request");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const targetPath = this.resolveStackFilePath(stack, relativePath);
                await fsAsync.mkdir(path.dirname(targetPath), { recursive: true });
                await fsAsync.writeFile(targetPath, content, "utf-8");
                callbackResult({
                    ok: true,
                    msg: "Saved",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileDelete", async (stackName : unknown, relativePath : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string" || typeof(relativePath) !== "string") {
                    throw new ValidationError("Invalid file request");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const targetPath = this.resolveStackFilePath(stack, relativePath);
                await fsAsync.rm(targetPath, {
                    recursive: true,
                    force: true
                });
                callbackResult({
                    ok: true,
                    msg: "Deleted",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileUpload", async (stackName : unknown, relativePath : unknown, fileName : unknown, contentBase64 : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string" || typeof(relativePath) !== "string" || typeof(fileName) !== "string" || typeof(contentBase64) !== "string") {
                    throw new ValidationError("Invalid upload request");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const folderPath = this.resolveStackFilePath(stack, relativePath);
                const filePath = this.resolveStackFilePath(stack, path.posix.join(relativePath.replace(/\\/g, "/"), fileName));
                await fsAsync.mkdir(folderPath, { recursive: true });
                await fsAsync.writeFile(filePath, Buffer.from(contentBase64, "base64"));
                callbackResult({
                    ok: true,
                    msg: "Uploaded",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        agentSocket.on("stackFileDownload", async (stackName : unknown, relativePath : unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof(stackName) !== "string" || typeof(relativePath) !== "string") {
                    throw new ValidationError("Invalid download request");
                }
                await requireStackAccess(socket, stackName, socket.endpoint);
                const stack = await Stack.getStack(server, stackName);
                const targetPath = this.resolveStackFilePath(stack, relativePath);
                callbackResult({
                    ok: true,
                    fileName: path.basename(targetPath),
                    contentBase64: (await fsAsync.readFile(targetPath)).toString("base64"),
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    async saveStack(server : DockgeServer, name : unknown, composeYAML : unknown, composeENV : unknown, isAdd : unknown) : Promise<Stack> {
        // Check types
        if (typeof(name) !== "string") {
            throw new ValidationError("Name must be a string");
        }
        if (typeof(composeYAML) !== "string") {
            throw new ValidationError("Compose YAML must be a string");
        }
        if (typeof(composeENV) !== "string") {
            throw new ValidationError("Compose ENV must be a string");
        }
        if (typeof(isAdd) !== "boolean") {
            throw new ValidationError("isAdd must be a boolean");
        }

        const stack = new Stack(server, name, composeYAML, composeENV, false);
        await stack.save(isAdd);
        return stack;
    }

    resolveStackFilePath(stack: Stack, relativePath: string) {
        const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
        const stackRoot = path.resolve(stack.fullPath);
        const targetPath = path.resolve(path.join(stackRoot, normalized));

        if (targetPath !== stackRoot && !targetPath.startsWith(stackRoot + path.sep)) {
            throw new ValidationError("Invalid file path");
        }

        return targetPath;
    }

    async getDockerImages(server : DockgeServer) {
        const imageRes = await spawnDocker(server, [ "image", "ls", "--digests", "--no-trunc", "--format", "{{json .}}" ], undefined, {
            encoding: "utf-8",
        });
        const containerRes = await spawnDocker(server, [ "ps", "-a", "--no-trunc", "--format", "{{json .}}" ], undefined, {
            encoding: "utf-8",
        });

        const usedImageRefs = new Set<string>();
        for (const line of (containerRes.stdout?.toString() || "").split("\n")) {
            if (!line.trim()) {
                continue;
            }
            const parsed = JSON.parse(line) as Record<string, string>;
            if (parsed.Image) {
                usedImageRefs.add(parsed.Image);
            }
        }

        return (imageRes.stdout?.toString() || "")
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line) as Record<string, string>)
            .map((image) => {
                const repoTag = `${image.Repository}:${image.Tag}`;
                return {
                    id: image.ID,
                    repository: image.Repository,
                    tag: image.Tag,
                    size: image.Size,
                    digest: image.Digest,
                    createdSince: image.CreatedSince,
                    used: usedImageRefs.has(repoTag) || usedImageRefs.has(image.ID),
                };
            });
    }

}
