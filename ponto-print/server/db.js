import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

// WAL = leituras não bloqueiam escritas; bom para um site com painel aberto ao mesmo tempo.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 3000;

  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    nome        TEXT    NOT NULL,
    telefone    TEXT    NOT NULL,
    email       TEXT,
    tipo        TEXT    NOT NULL,
    quantidade  TEXT,
    mensagem    TEXT,
    origem      TEXT,
    ip_hash     TEXT,
    user_agent  TEXT,
    status      TEXT    NOT NULL DEFAULT 'novo'
                CHECK (status IN ('novo','contatado','orcado','fechado','perdido','spam')),
    updated_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);
`);

export const STATUSES = ['novo', 'contatado', 'orcado', 'fechado', 'perdido', 'spam'];

const stmts = {
  insert: db.prepare(`
    INSERT INTO leads (nome, telefone, email, tipo, quantidade, mensagem, origem, ip_hash, user_agent)
    VALUES (@nome, @telefone, @email, @tipo, @quantidade, @mensagem, @origem, @ip_hash, @user_agent)
  `),
  byId: db.prepare(`SELECT * FROM leads WHERE id = ?`),
  updateStatus: db.prepare(`
    UPDATE leads SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?
  `),
  counts: db.prepare(`SELECT status, COUNT(*) AS total FROM leads GROUP BY status`),
  // Anti-abuso complementar ao rate limit: mesmo telefone repetido em pouco tempo.
  recentByPhone: db.prepare(`
    SELECT COUNT(*) AS n FROM leads
    WHERE telefone = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-10 minutes')
  `),
};

export function insertLead(lead) {
  const info = stmts.insert.run({
    nome: lead.nome,
    telefone: lead.telefone,
    email: lead.email ?? null,
    tipo: lead.tipo,
    quantidade: lead.quantidade ?? null,
    mensagem: lead.mensagem ?? null,
    origem: lead.origem ?? null,
    ip_hash: lead.ip_hash ?? null,
    user_agent: lead.user_agent ?? null,
  });
  return stmts.byId.get(Number(info.lastInsertRowid));
}

export function getLead(id) {
  return stmts.byId.get(id) ?? null;
}

export function updateLeadStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error('status inválido');
  const info = stmts.updateStatus.run(status, id);
  return info.changes > 0 ? stmts.byId.get(id) : null;
}

export function countRecentByPhone(telefone) {
  return stmts.recentByPhone.get(telefone).n;
}

export function countsByStatus() {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of stmts.counts.all()) out[row.status] = row.total;
  return out;
}

/**
 * Lista com filtro/paginação. O SQL é montado só com fragmentos fixos;
 * todo valor vindo do usuário entra como parâmetro.
 */
export function listLeads({ status, q, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];

  if (status && STATUSES.includes(status)) {
    where.push('status = ?');
    params.push(status);
  } else if (!status) {
    where.push(`status <> 'spam'`);
  }
  if (q) {
    where.push('(nome LIKE ? OR telefone LIKE ? OR email LIKE ? OR mensagem LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM leads ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM leads ${whereSql}`).get(...params);

  return { rows, total, limit, offset };
}

export function closeDb() {
  try {
    db.close();
  } catch {
    /* já fechado */
  }
}
