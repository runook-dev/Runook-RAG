/**
 * Fast read of RAGFlow users straight from its MySQL (host-mapped), instead of
 * spawning a heavy Python process. Read-only.
 */
import { config } from "./config";

export interface RagflowUser {
  id: string;
  email: string;
  nickname: string | null;
  is_active: string;
  login_channel: string | null;
  is_superuser: number | boolean | null;
  create_date: string | null;
}

export async function listRagflowUsers(): Promise<RagflowUser[]> {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    connectTimeout: 8000,
  });
  try {
    const [rows] = await conn.query(
      "SELECT id, email, nickname, is_active, login_channel, is_superuser, create_date FROM user"
    );
    return (rows as any[]).map((r) => ({
      id: r.id,
      email: String(r.email || "").toLowerCase(),
      nickname: r.nickname,
      is_active: String(r.is_active),
      login_channel: r.login_channel,
      is_superuser: r.is_superuser,
      create_date: r.create_date ? new Date(r.create_date).toISOString() : null,
    }));
  } finally {
    await conn.end();
  }
}
