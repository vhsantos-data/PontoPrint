import { Router } from 'express';
import { z } from 'zod';
import { listLeads, updateLeadStatus, countsByStatus, STATUSES } from '../db.js';
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
  const cols = ['id', 'created_at', 'status', 'nome', 'telefone', 'email', 'tipo', 'quantidade', 'origem', 'mensagem'];
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

const statusBody = z.object({ status: z.enum(STATUSES) });

adminRouter.patch('/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: 'ID inválido.' });
  const parsed = statusBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(422).json({ erro: 'Status inválido.', validos: STATUSES });

  const lead = updateLeadStatus(id, parsed.data.status);
  if (!lead) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  res.json({ ok: true, lead });
});
