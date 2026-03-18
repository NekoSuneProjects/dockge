import { SocketHandler } from "../socket-handler.js";
import { DockgeServer } from "../dockge-server";
import { log } from "../log";
import { callbackError, callbackResult, checkLogin, DockgeSocket } from "../util-server";
import { LooseObject } from "../../common/util-common";
import { requireAdmin } from "../auth";

export class ManageAgentSocketHandler extends SocketHandler {

    create(socket : DockgeSocket, server : DockgeServer) {
        // addAgent
        socket.on("addAgent", async (requestData : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "addAgent");
                checkLogin(socket);
                await requireAdmin(socket);

                if (typeof(requestData) !== "object") {
                    throw new Error("Data must be an object");
                }

                let data = requestData as LooseObject;
                let manager = socket.instanceManager;
                await manager.test(data.url, data.username, data.password);
                await manager.add(data.url, data.username, data.password, typeof data.nickname === "string" ? data.nickname.trim() : "");

                // connect to the agent
                manager.connect(data.url, data.username, data.password);

                // Refresh another sockets
                // It is a bit difficult to control another browser sessions to connect/disconnect agents, so force them to refresh the page will be easier.
                server.disconnectAllSocketClients(undefined, socket.id);
                manager.sendAgentList();

                callbackResult({
                    ok: true,
                    msg: "agentAddedSuccessfully",
                    msgi18n: true,
                }, callback);

            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("updateAgent", async (requestData : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "updateAgent");
                checkLogin(socket);
                await requireAdmin(socket);

                if (typeof requestData !== "object" || requestData === null) {
                    throw new Error("Data must be an object");
                }

                const data = requestData as LooseObject;
                if (typeof data.url !== "string" || !data.url) {
                    throw new Error("URL is required");
                }

                const manager = socket.instanceManager;
                await manager.update(data.url, {
                    username: typeof data.username === "string" ? data.username : undefined,
                    password: typeof data.password === "string" ? data.password : undefined,
                    nickname: typeof data.nickname === "string" ? data.nickname : undefined,
                });

                server.disconnectAllSocketClients(undefined, socket.id);
                manager.sendAgentList();

                callbackResult({
                    ok: true,
                    msg: "Agent updated successfully.",
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // removeAgent
        socket.on("removeAgent", async (url : unknown, callback : unknown) => {
            try {
                log.debug("manage-agent-socket-handler", "removeAgent");
                checkLogin(socket);
                await requireAdmin(socket);

                if (typeof(url) !== "string") {
                    throw new Error("URL must be a string");
                }

                let manager = socket.instanceManager;
                await manager.remove(url);

                server.disconnectAllSocketClients(undefined, socket.id);
                manager.sendAgentList();

                callbackResult({
                    ok: true,
                    msg: "agentRemovedSuccessfully",
                    msgi18n: true,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
