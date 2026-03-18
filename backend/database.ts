import { log } from "./log";
import { R } from "redbean-node";
import { DockgeServer } from "./dockge-server";
import fs from "fs";
import path from "path";
import knex from "knex";
import type { Knex } from "knex";

// @ts-ignore
import Dialect from "knex/lib/dialects/sqlite3/index.js";

import sqlite from "@louislam/sqlite3";
import { sleep } from "../common/util-common";

interface DBConfig {
    type?: "sqlite" | "mysql";
    hostname?: string;
    port?: string;
    database?: string;
    username?: string;
    password?: string;
}

export class Database {
    /**
     * SQLite file path (Default: ./data/dockge.db)
     * @type {string}
     */
    static sqlitePath : string;

    static noReject = true;

    static dbConfig: DBConfig = {};

    static knexMigrationsPath = "./backend/migrations";

    private static server : DockgeServer;

    /**
     * Use for decode the auth object
     */
    jwtSecret? : string;

    static async init(server : DockgeServer) {
        this.server = server;

        log.debug("server", "Connecting to the database");
        await Database.connect();
        log.info("server", "Connected to the database");

        // Patch the database
        await Database.patch();
    }

    /**
     * Read the database config
     * @throws {Error} If the config is invalid
     * @typedef {string|undefined} envString
     * @returns {{type: "sqlite"} | {type:envString, hostname:envString, port:envString, database:envString, username:envString, password:envString}} Database config
     */
    static readDBConfig() : DBConfig {
        const dbConfigString = fs.readFileSync(path.join(this.server.config.dataDir, "db-config.json")).toString("utf-8");
        const dbConfig = JSON.parse(dbConfigString);

        if (typeof dbConfig !== "object") {
            throw new Error("Invalid db-config.json, it must be an object");
        }

        if (typeof dbConfig.type !== "string") {
            throw new Error("Invalid db-config.json, type must be a string");
        }
        return dbConfig;
    }

    /**
     * @typedef {string|undefined} envString
     * @param dbConfig the database configuration that should be written
     * @returns {void}
     */
    static writeDBConfig(dbConfig : DBConfig) {
        fs.writeFileSync(path.join(this.server.config.dataDir, "db-config.json"), JSON.stringify(dbConfig, null, 4));
    }

    /**
     * Connect to the database
     * @param {boolean} autoloadModels Should models be automatically loaded?
     * @param {boolean} noLog Should logs not be output?
     * @returns {Promise<void>}
     */
    static async connect(autoloadModels = true) {
        const acquireConnectionTimeout = 120 * 1000;
        let dbConfig : DBConfig;
        try {
            dbConfig = this.readDBConfig();
            Database.dbConfig = dbConfig;
        } catch (err) {
            if (err instanceof Error) {
                log.warn("db", err.message);
            }

            dbConfig = {
                type: "sqlite",
            };
            this.writeDBConfig(dbConfig);
        }

        let config = {};

        log.info("db", `Database Type: ${dbConfig.type}`);

        if (dbConfig.type === "sqlite") {
            this.sqlitePath = path.join(this.server.config.dataDir, "dockge.db");
            Dialect.prototype._driver = () => sqlite;

            config = {
                client: Dialect,
                connection: {
                    filename: Database.sqlitePath,
                    acquireConnectionTimeout: acquireConnectionTimeout,
                },
                useNullAsDefault: true,
                pool: {
                    min: 1,
                    max: 1,
                    idleTimeoutMillis: 120 * 1000,
                    propagateCreateError: false,
                    acquireTimeoutMillis: acquireConnectionTimeout,
                }
            };
        } else {
            throw new Error("Unknown Database type: " + dbConfig.type);
        }

        const knexInstance = knex(config);

        // @ts-ignore
        R.setup(knexInstance);

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        // Auto map the model to a bean object
        R.freeze(true);

        if (autoloadModels) {
            R.autoloadModels("./backend/models", "ts");
        }

        if (dbConfig.type === "sqlite") {
            await this.initSQLite();
        }
    }

    /**
     @returns {Promise<void>}
     */
    static async initSQLite() {
        await R.exec("PRAGMA foreign_keys = ON");
        // Change to WAL
        await R.exec("PRAGMA journal_mode = WAL");
        await R.exec("PRAGMA cache_size = -12000");
        await R.exec("PRAGMA auto_vacuum = INCREMENTAL");

        // This ensures that an operating system crash or power failure will not corrupt the database.
        // FULL synchronous is very safe, but it is also slower.
        // Read more: https://sqlite.org/pragma.html#pragma_synchronous
        await R.exec("PRAGMA synchronous = NORMAL");

        log.debug("db", "SQLite config:");
        log.debug("db", await R.getAll("PRAGMA journal_mode"));
        log.debug("db", await R.getAll("PRAGMA cache_size"));
        log.debug("db", "SQLite Version: " + await R.getCell("SELECT sqlite_version()"));
    }

    /**
     * Patch the database
     * @returns {void}
     */
    static async patch() {
        // Using knex migrations
        // https://knexjs.org/guide/migrations.html
        // https://gist.github.com/NigelEarle/70db130cc040cc2868555b29a0278261
        try {
            await R.knex.migrate.latest({
                directory: Database.knexMigrationsPath,
            });
        } catch (e) {
            if (e instanceof Error) {
                // Allow missing patch files for downgrade or testing pr.
                if (e.message.includes("the following files are missing:")) {
                    log.warn("db", e.message);
                    log.warn("db", "Database migration failed, you may be downgrading Dockge.");
                } else {
                    log.error("db", "Database migration failed");
                    throw e;
                }
            }
        }

        await Database.ensureForkSchemaCompatibility();
    }

    /**
     * Keep official Dockge SQLite databases upgrade-safe when switching to this fork.
     * This is intentionally additive: it only creates missing tables/columns and backfills defaults.
     */
    static async ensureForkSchemaCompatibility() {
        const knex = R.knex;

        if (await knex.schema.hasTable("user")) {
            const missingColumns = {
                role: !(await knex.schema.hasColumn("user", "role")),
                auth_provider: !(await knex.schema.hasColumn("user", "auth_provider")),
                provider_subject: !(await knex.schema.hasColumn("user", "provider_subject")),
                display_name: !(await knex.schema.hasColumn("user", "display_name")),
                owner: !(await knex.schema.hasColumn("user", "owner")),
            };

            if (Object.values(missingColumns).some(Boolean)) {
                await knex.schema.alterTable("user", (table: Knex.AlterTableBuilder) => {
                    if (missingColumns.role) {
                        table.string("role", 32).notNullable().defaultTo("admin");
                    }
                    if (missingColumns.auth_provider) {
                        table.string("auth_provider", 32).notNullable().defaultTo("local");
                    }
                    if (missingColumns.provider_subject) {
                        table.string("provider_subject", 255).nullable();
                    }
                    if (missingColumns.display_name) {
                        table.string("display_name", 255).nullable();
                    }
                    if (missingColumns.owner) {
                        table.boolean("owner").notNullable().defaultTo(false);
                    }
                });
            }

            if (await knex.schema.hasColumn("user", "role")) {
                await knex.raw("UPDATE `user` SET `role` = COALESCE(`role`, 'admin')");
            }

            if (await knex.schema.hasColumn("user", "auth_provider")) {
                await knex.raw("UPDATE `user` SET `auth_provider` = COALESCE(`auth_provider`, 'local')");
            }

            if (await knex.schema.hasColumn("user", "display_name")) {
                await knex.raw("UPDATE `user` SET `display_name` = `username` WHERE `display_name` IS NULL");
            }

            if (await knex.schema.hasColumn("user", "owner")) {
                const existingOwner = await knex("user").where({ owner: true }).first();
                if (!existingOwner) {
                    const firstUser = await knex("user").orderBy("id", "asc").first("id");
                    if (firstUser) {
                        const updatePayload: Record<string, unknown> = {
                            owner: true,
                        };

                        if (await knex.schema.hasColumn("user", "role")) {
                            updatePayload.role = "admin";
                        }

                        if (await knex.schema.hasColumn("user", "auth_provider")) {
                            updatePayload.auth_provider = "local";
                        }

                        await knex("user").where({ id: firstUser.id }).update(updatePayload);
                    }
                }
            }
        }

        if (await knex.schema.hasTable("agent")) {
            const missingColumns = {
                nickname: !(await knex.schema.hasColumn("agent", "nickname")),
            };

            if (missingColumns.nickname) {
                await knex.schema.alterTable("agent", (table: Knex.AlterTableBuilder) => {
                    table.string("nickname", 255).nullable();
                });
            }
        }

        if (!await knex.schema.hasTable("stack_access")) {
            await knex.schema.createTable("stack_access", (table: Knex.CreateTableBuilder) => {
                table.increments("id");
                table.integer("user_id").unsigned().notNullable();
                table.string("stack_name", 255).notNullable();
                table.string("endpoint", 255).notNullable().defaultTo("");
                table.foreign("user_id").references("user.id").onDelete("CASCADE");
                table.unique([ "user_id", "stack_name", "endpoint" ]);
            });
        }
    }

    /**
     * Special handle, because tarn.js throw a promise reject that cannot be caught
     * @returns {Promise<void>}
     */
    static async close() {
        const listener = () => {
            Database.noReject = false;
        };
        process.addListener("unhandledRejection", listener);

        log.info("db", "Closing the database");

        // Flush WAL to main database
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        }

        while (true) {
            Database.noReject = true;
            await R.close();
            await sleep(2000);

            if (Database.noReject) {
                break;
            } else {
                log.info("db", "Waiting to close the database");
            }
        }
        log.info("db", "Database closed");

        process.removeListener("unhandledRejection", listener);
    }

    /**
     * Get the size of the database (SQLite only)
     * @returns {number} Size of database
     */
    static getSize() {
        if (Database.dbConfig.type === "sqlite") {
            log.debug("db", "Database.getSize()");
            const stats = fs.statSync(Database.sqlitePath);
            log.debug("db", stats);
            return stats.size;
        }
        return 0;
    }

    /**
     * Shrink the database
     * @returns {Promise<void>}
     */
    static async shrink() {
        if (Database.dbConfig.type === "sqlite") {
            await R.exec("VACUUM");
        }
    }

}
