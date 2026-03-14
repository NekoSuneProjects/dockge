import { DockgeServer } from "../dockge-server";
import { Router } from "../router";
import express, { Express, Router as ExpressRouter } from "express";
import { completeOAuth, startOAuth } from "../oauth";

export class MainRouter extends Router {
    create(app: Express, server: DockgeServer): ExpressRouter {
        const router = express.Router();

        router.get("/", (req, res) => {
            res.send(server.indexHTML);
        });

        // Robots.txt
        router.get("/robots.txt", async (_request, response) => {
            let txt = "User-agent: *\nDisallow: /";
            response.setHeader("Content-Type", "text/plain");
            response.send(txt);
        });

        router.get("/auth/oauth/start/:providerID", async (request, response) => {
            await startOAuth(response, request);
        });

        router.get("/auth/oauth/callback/:providerID", async (request, response) => {
            await completeOAuth(server, response, request);
        });

        return router;
    }

}
