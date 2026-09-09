import { createHash, timingSafeEqual } from 'node:crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/** Cabeçalhos de segurança + CSP restrita (sem script inline; fontes só do Google Fonts). */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      // Em dev (http://localhost) não faz sentido forçar upgrade para https.
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // fontes externas
  hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
});

/** Redireciona HTTP → HTTPS quando atrás de proxy em produção. */
export function forceHttps(req, res, next) {
  if (!config.isProd || req.secure || req.path === '/health') return next();
  const host = req.get('host');
  return res.redirect(301, `https://${host}${req.originalUrl}`);
}

/** CORS mínimo: só a própria origem pública (ou nenhuma). Sem "*" em produção. */
export function cors(req, res, next) {
  const origin = req.get('origin');
  if (origin && config.publicUrl && origin === config.publicUrl) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.set('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

const limiterDefaults = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
};

/** Limite geral da API. */
export const apiLimiter = rateLimit({ ...limiterDefaults, windowMs: 15 * 60 * 1000, limit: 300 });

/** Limite do beacon de métricas (pageview + cliques). */
export const eventoLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 100 });

/** Limite do formulário de orçamento (por IP). */
export const leadLimiter = rateLimit({ ...limiterDefaults, windowMs: 10 * 60 * 1000, limit: 6 });

/** Limite de tentativas no painel (freia força bruta no token). */
export const adminLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  skipSuccessfulRequests: true,
});

/** Autenticação do painel: Bearer token comparado em tempo constante. */
export function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(config.adminToken);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    res.set('WWW-Authenticate', 'Bearer realm="admin"');
    return res.status(401).json({ erro: 'Não autorizado.' });
  }
  next();
}

/** Hash do IP com sal — permite investigar abuso sem guardar o IP em claro (LGPD). */
export function hashIp(ip) {
  if (!ip) return null;
  return createHash('sha256').update(`${config.ipHashSalt}:${ip}`).digest('hex').slice(0, 32);
}

/** Remove caracteres de controle e normaliza espaços (multiline preserva quebras de linha). */
export function clean(str, { multiline = false } = {}) {
  if (typeof str !== 'string') return str;
  // eslint-disable-next-line no-control-regex
  let out = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  out = multiline
    ? out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : out.replace(/\s+/g, ' ');
  return out.trim();
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests/i;
export function isBot(ua) {
  return !ua || BOT_RE.test(ua);
}

/** Data de hoje no fuso da loja (YYYY-MM-DD). */
export function diaHoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Identificador de visitante que muda todo dia: hash(sal + dia + ip + navegador).
 * Permite contar "pessoas" sem cookie e sem seguir ninguém entre dias (LGPD-friendly).
 */
export function visitanteHash(ip, ua, dia = diaHoje()) {
  return createHash('sha256').update(`${config.ipHashSalt}:${dia}:${ip || ''}:${ua || ''}`).digest('hex').slice(0, 24);
}

export function dispositivo(ua = '') {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'celular';
  return 'computador';
}
