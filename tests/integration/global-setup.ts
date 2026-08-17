import { Pool } from 'pg'

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) return

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
    await pool.query('CREATE SCHEMA public')
  } finally {
    await pool.end()
  }
}
