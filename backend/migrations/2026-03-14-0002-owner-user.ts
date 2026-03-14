import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    const hasOwner = await knex.schema.hasColumn("user", "owner");
    if (!hasOwner) {
        await knex.schema.alterTable("user", (table) => {
            table.boolean("owner").notNullable().defaultTo(false);
        });
    }

    const existingOwner = await knex("user").where({ owner: true }).first();
    if (!existingOwner) {
        const firstUser = await knex("user").orderBy("id", "asc").first("id");
        if (firstUser) {
            await knex("user").where({ id: firstUser.id }).update({
                owner: true,
                role: "admin",
                active: true,
                auth_provider: knex.raw("COALESCE(auth_provider, 'local')"),
            });
        }
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasOwner = await knex.schema.hasColumn("user", "owner");
    if (hasOwner) {
        await knex.schema.alterTable("user", (table) => {
            table.dropColumn("owner");
        });
    }
}
