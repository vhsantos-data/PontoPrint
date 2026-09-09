import { Router } from 'express';
import { z } from 'zod';
import { insertEvento } from '../db.js';
import { eventoLimiter, clean, isBot, diaHoje, visitanteHash, dispositivo } from '../middleware/security.js';

export const eventosRouter = Router();

// Rótulos de clique aceitos = os data-wa da página + o botão pós-formulário.
export const ROTULOS = ['hero', 'empresa', 'evento', 'fotos', 'personalizado', 'portfolio', 'ajuda', 'final', 'form-continuar'];

const schema = z.object({
  tipo: z.enum(['pageview', 'cta']),
  rotulo: z.enum(ROTULOS).optional(),
  caminho: z.string().transform(clean).pipe(z.string().max(100)).optional(),
  ref: z.string().max(300).optional().or(z.literal('')),
  utm: z.string().transform(clean).pipe(z.string().max(60)).optional().or(z.literal('')),
});

/** Guarda só o domínio da origem (sem URL completa, sem query string). */
function hostDe(url, proprio) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host && host !== proprio ? host : null;
  } catch {
    return null;
  }
}

/**
 * Beacon de métricas. Sempre responde 204 (o navegador não se importa com o resultado);
 * bots e payloads inválidos são descartados em silêncio.
 */
eventosRouter.post('/evento', eventoLimiter, (req, res) => {
  res.status(204).end();

  const ua = req.get('user-agent') || '';
  if (isBot(ua)) return;
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return;
  const ev = parsed.data;
  if (ev.tipo === 'cta' && !ev.rotulo) return;

  const dia = diaHoje();
  insertEvento({
    dia,
    tipo: ev.tipo,
    rotulo: ev.rotulo ?? null,
    caminho: ev.caminho || '/',
    origem: hostDe(ev.ref, req.hostname),
    utm: ev.utm ? ev.utm.toLowerCase() : null,
    dispositivo: dispositivo(ua),
    visitante_hash: visitanteHash(req.ip, ua, dia),
  });
});
