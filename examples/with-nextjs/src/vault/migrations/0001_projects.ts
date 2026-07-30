import type { Vault } from '@towerjs/vault'

export async function up(db: Vault) {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute()
}

export async function down(db: Vault) {
  await db.schema.dropTable('projects').execute()
}
