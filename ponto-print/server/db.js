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

  -- Métricas do site: uma linha por visita, clique em WhatsApp ou pedido enviado.
  -- Nada aqui identifica uma pessoa: visitante_hash muda todo dia.
  CREATE TABLE IF NOT EXISTS eventos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    dia            TEXT NOT NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('pageview','cta','lead')),
    rotulo         TEXT,
    caminho        TEXT,
    origem         TEXT,
    utm            TEXT,
    dispositivo    TEXT,
    visitante_hash TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_eventos_dia_tipo ON eventos(dia, tipo);
`);

/** Adiciona colunas novas em bancos já existentes (migração leve). */
function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
ensureColumn('leads', 'obs', 'TEXT');
ensureColumn('leads', 'valor', 'REAL');

export const STATUSES = ['novo', 'contatado', 'orcado', 'fechado', 'perdido', 'spam'];

const stmts = {
  insert: db.prepare(`
    INSERT INTO leads (nome, telefone, email, tipo, quantidade, mensagem, origem, ip_hash, user_agent)
    VALUES (@nome, @telefone, @email, @tipo, @quantidade, @mensagem, @origem, @ip_hash, @user_agent)
  `),
  byId: db.prepare(`SELECT * FROM leads WHERE id = ?`),
  insertEvento: db.prepare(`
    INSERT INTO eventos (dia, tipo, rotulo, caminho, origem, utm, dispositivo, visitante_hash)
    VALUES (@dia, @tipo, @rotulo, @caminho, @origem, @utm, @dispositivo, @visitante_hash)
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

const LEAD_EDITAVEIS = ['status', 'obs', 'valor'];

/** Atualiza só campos permitidos; o SET é montado a partir de uma lista fixa de colunas. */
export function updateLead(id, changes) {
  const sets = [];
  const params = [];
  for (const col of LEAD_EDITAVEIS) {
    if (!(col in changes)) continue;
    if (col === 'status' && !STATUSES.includes(changes.status)) throw new Error('status inválido');
    sets.push(`${col} = ?`);
    params.push(changes[col]);
  }
  if (!sets.length) return stmts.byId.get(id) ?? null;
  const info = db
    .prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .run(...params, id);
  return info.changes > 0 ? stmts.byId.get(id) : null;
}

// ---------------- Métricas ----------------

export function insertEvento(ev) {
  stmts.insertEvento.run({
    dia: ev.dia,
    tipo: ev.tipo,
    rotulo: ev.rotulo ?? null,
    caminho: ev.caminho ?? null,
    origem: ev.origem ?? null,
    utm: ev.utm ?? null,
    dispositivo: ev.dispositivo ?? null,
    visitante_hash: ev.visitante_hash,
  });
}

export function pruneEventos(dias) {
  return db.prepare(`DELETE FROM eventos WHERE dia < date('now', ?)`).run(`-${dias} days`).changes;
}

function resumoPeriodo(desde) {
  return db
    .prepare(`
      SELECT
        COUNT(*) FILTER (WHERE tipo = 'pageview') AS visitas,
        COUNT(DISTINCT CASE WHEN tipo = 'pageview' THEN visitante_hash END) AS visitantes,
        COUNT(*) FILTER (WHERE tipo = 'cta') AS cliques,
        COUNT(DISTINCT CASE WHEN tipo = 'cta' THEN visitante_hash END) AS visitantes_clicaram,
        COUNT(*) FILTER (WHERE tipo = 'lead') AS pedidos
      FROM eventos WHERE dia >= ?
    `)
    .get(desde);
}

/** Tudo que a aba "Visão geral" do painel precisa, para um período em dias. */
export function metricas(dias = 30) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const desdeDate = new Date(`${hoje}T12:00:00Z`);
  desdeDate.setUTCDate(desdeDate.getUTCDate() - (dias - 1));
  const desde = desdeDate.toISOString().slice(0, 10);
  const desde7 = new Date(`${hoje}T12:00:00Z`);
  desde7.setUTCDate(desde7.getUTCDate() - 6);

  const porDia = db
    .prepare(`
      SELECT dia,
        COUNT(DISTINCT CASE WHEN tipo = 'pageview' THEN visitante_hash END) AS visitantes,
        COUNT(*) FILTER (WHERE tipo = 'pageview') AS visitas,
        COUNT(*) FILTER (WHERE tipo = 'cta') AS cliques,
        COUNT(*) FILTER (WHERE tipo = 'lead') AS pedidos
      FROM eventos WHERE dia >= ? GROUP BY dia ORDER BY dia
    `)
    .all(desde);

  // preenche dias sem evento com zero, para o gráfico não pular datas
  const mapa = new Map(porDia.map((r) => [r.dia, r]));
  const serie = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(desdeDate);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    serie.push(mapa.get(key) ?? { dia: key, visitantes: 0, visitas: 0, cliques: 0, pedidos: 0 });
  }

  const top = (sql, ...p) => db.prepare(sql).all(...p);

  return {
    dias,
    desde,
    hoje: resumoPeriodo(hoje),
    ultimos7: resumoPeriodo(desde7.toISOString().slice(0, 10)),
    periodo: resumoPeriodo(desde),
    serie,
    ctas: top(`SELECT rotulo, COUNT(*) AS n FROM eventos WHERE tipo = 'cta' AND dia >= ? GROUP BY rotulo ORDER BY n DESC`, desde),
    origens: top(
      `SELECT COALESCE(NULLIF(utm, ''), NULLIF(origem, ''), 'direto') AS origem, COUNT(DISTINCT visitante_hash) AS n
       FROM eventos WHERE tipo = 'pageview' AND dia >= ? GROUP BY 1 ORDER BY n DESC LIMIT 8`,
      desde,
    ),
    dispositivos: top(
      `SELECT COALESCE(dispositivo, 'desconhecido') AS dispositivo, COUNT(DISTINCT visitante_hash) AS n
       FROM eventos WHERE tipo = 'pageview' AND dia >= ? GROUP BY 1 ORDER BY n DESC`,
      desde,
    ),
    pedidosPorTipo: top(
      `SELECT tipo, COUNT(*) AS n FROM leads WHERE status <> 'spam' AND substr(created_at, 1, 10) >= ? GROUP BY tipo ORDER BY n DESC`,
      desde,
    ),
    funil: db
      .prepare(`
        SELECT status, COUNT(*) AS n, COALESCE(SUM(valor), 0) AS valor
        FROM leads WHERE substr(created_at, 1, 10) >= ? GROUP BY status
      `)
      .all(desde),
  };
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
