import { Router } from 'express';
import { z } from 'zod';
import { listLeads, updateLead, countsByStatus, metricas, STATUSES } from '../db.js';
import { adminLimiter, requireAdmin, clean } from '../middleware/security.js';

export const adminRouter = Router();

adminRouter.use(adminLimiter, requireAdmin);

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().transform(clean).pipe(z.string().max(60)).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get('/leads', (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ erro: 'Parâmetros inválidos.' });
  res.json({ ...listLeads(parsed.data), resumo: countsByStatus() });
});

adminRouter.get('/leads.csv', (req, res) => {
  const parsed = listQuery.safeParse({ ...req.query, limit: 200 });
  if (!parsed.success) return res.status(400).json({ erro: 'Parâmetros inválidos.' });

  const { rows } = listLeads({ ...parsed.data, limit: 5000 });
  const cols = ['id', 'created_at', 'status', 'valor', 'nome', 'telefone', 'email', 'tipo', 'quantidade', 'origem', 'mensagem', 'obs'];
  // Aspas duplicadas + prefixo em células que começam com = + - @ (evita fórmulas maliciosas ao abrir no Excel).
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => cell(r[c])).join(';'))].join('\r\n');

  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${csv}`); // BOM para o Excel reconhecer UTF-8
});

/** Aceita "1.234,50", "1234,50", "1234.50" ou "1234". */
function parseValorBR(v) {
  const t = String(v).trim().replace(/^R\$\s*/, '');
  if (!t) return null;
  if (!/^[\d.,]+$/.test(t)) return Number.NaN;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(norm);
}

const patchBody = z
  .object({
    status: z.enum(STATUSES).optional(),
    obs: z
      .string()
      .transform((v) => clean(v, { multiline: true }))
      .pipe(z.string().max(1000))
      .nullable()
      .optional(),
    valor: z
      .preprocess((v) => (v === '' || v === null ? null : typeof v === 'string' ? parseValorBR(v) : v), z.number().min(0).max(10_000_000).nullable())
      .optional(),
  })
  .strict();

adminRouter.patch('/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: 'ID inválido.' });
  const parsed = patchBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(422).json({ erro: 'Dados inválidos.', validos: STATUSES });

  const lead = updateLead(id, parsed.data);
  if (!lead) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  res.json({ ok: true, lead });
});

adminRouter.get('/metricas', (req, res) => {
  const dias = z.coerce.number().int().min(7).max(180).default(30).safeParse(req.query.dias);
  res.json(metricas(dias.success ? dias.data : 30));
});
