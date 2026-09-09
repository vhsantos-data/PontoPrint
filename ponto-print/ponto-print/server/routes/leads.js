import { Router } from 'express';
import { z } from 'zod';
import { insertLead, countRecentByPhone, insertEvento } from '../db.js';
import { notifyNewLead } from '../services/notify.js';
import { leadLimiter, hashIp, clean, diaHoje, visitanteHash, dispositivo } from '../middleware/security.js';

export const leadsRouter = Router();

export const TIPOS = ['empresa', 'evento', 'fotos', 'personalizado', 'nao-sei'];

// Telefone BR: aceita máscara, guarda só dígitos (DDD + número, com ou sem 55).
const telefone = z
  .string({ error: 'Informe um WhatsApp válido com DDD.' })
  .transform((v) => v.replace(/\D/g, ''))
  .refine((d) => d.length >= 10 && d.length <= 13, 'Informe um WhatsApp válido com DDD.')
  .transform((d) => (d.startsWith('55') && d.length >= 12 ? d : `55${d}`));

const schema = z.object({
  nome: z.string({ error: 'Informe seu nome.' }).transform(clean).pipe(z.string().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.')),
  telefone,
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
  tipo: z.enum(TIPOS, { error: 'Escolha o tipo de material.' }),
  quantidade: z
    .string()
    .transform(clean)
    .pipe(z.string().max(40))
    .optional()
    .transform((v) => v || null),
  mensagem: z
    .string()
    .transform((v) => clean(v, { multiline: true }))
    .pipe(z.string().max(1500, 'Descrição muito longa (máx. 1500 caracteres).'))
    .optional()
    .transform((v) => v || null),
  origem: z.string().transform(clean).pipe(z.string().max(40)).optional(),
  consentimento: z.literal(true, { error: 'Precisamos da sua autorização para entrar em contato.' }),

  // Anti-bot: campo escondido que humanos não preenchem + instante em que o form foi carregado.
  site: z.string().max(200).optional(),
  t: z.coerce.number().optional(),
});

function fakeSuccess(res) {
  // Bots recebem "sucesso" para não aprenderem o que os denunciou.
  return res.status(201).json({ ok: true, id: 0 });
}

leadsRouter.post('/orcamento', leadLimiter, (req, res) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const erros = {};
    for (const issue of result.error.issues) {
      const campo = issue.path[0] ?? '_';
      if (!erros[campo]) erros[campo] = issue.message;
    }
    return res.status(422).json({ erro: 'Confira os campos destacados.', campos: erros });
  }

  const data = result.data;

  if (data.site) return fakeSuccess(res);
  if (data.t && Date.now() - data.t < 2500) return fakeSuccess(res);
  if (countRecentByPhone(data.telefone) >= 3) return fakeSuccess(res);

  const lead = insertLead({
    ...data,
    ip_hash: hashIp(req.ip),
    user_agent: clean(req.get('user-agent') || '').slice(0, 200) || null,
  });

  notifyNewLead(lead);

  const ua = req.get('user-agent') || '';
  const dia = diaHoje();
  insertEvento({ dia, tipo: 'lead', rotulo: data.tipo, caminho: '/#orcamento', dispositivo: dispositivo(ua), visitante_hash: visitanteHash(req.ip, ua, dia) });

  return res.status(201).json({ ok: true, id: lead.id });
});
