import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable("agent");
    if (!hasTable) {
        return;
    }

    const hasNickname = await knex.schema.hasColumn("agent", "nickname");
    if (!hasNickname) {
        await knex.schema.alterTable("agent", (table) => {
            table.string("nickname", 255).nullable();
        });
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable("agent");
    if (!hasTable) {
        return;
    }

    const hasNickname = await knex.schema.hasColumn("agent", "nickname");
    if (hasNickname) {
        await knex.schema.alterTable("agent", (table) => {
            table.dropColumn("nickname");
        });
    }
}
