import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    const hasRole = await knex.schema.hasColumn("user", "role");
    if (!hasRole) {
        await knex.schema.alterTable("user", (table) => {
            table.string("role", 32).notNullable().defaultTo("admin");
            table.string("auth_provider", 32).notNullable().defaultTo("local");
            table.string("provider_subject", 255).nullable();
            table.string("display_name", 255).nullable();
        });
    }

    await knex("user").update({
        role: "admin",
        auth_provider: "local",
    });
    await knex.raw("UPDATE `user` SET `display_name` = `username` WHERE `display_name` IS NULL");

    const hasUnique = await knex.schema.hasTable("stack_access");
    if (!hasUnique) {
        await knex.schema.createTable("stack_access", (table) => {
            table.increments("id");
            table.integer("user_id").unsigned().notNullable();
            table.string("stack_name", 255).notNullable();
            table.string("endpoint", 255).notNullable().defaultTo("");
            table.foreign("user_id").references("user.id").onDelete("CASCADE");
            table.unique([ "user_id", "stack_name", "endpoint" ]);
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("stack_access");
}
