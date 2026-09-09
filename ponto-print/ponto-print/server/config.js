import 'dotenv/config';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  PUBLIC_URL: z.url().optional(),

  // Em produção o token é obrigatório e precisa ser longo. Em dev, um token fraco é aceito com aviso.
  ADMIN_TOKEN: isProd ? z.string().min(32) : z.string().min(8).default('dev-token-inseguro'),
  IP_HASH_SALT: isProd ? z.string().min(16) : z.string().min(4).default('dev-salt'),

  DB_PATH: z.string().default('./data/pontoprint.db'),
  EVENTOS_RETENCAO_DIAS: z.coerce.number().int().min(7).default(180),

  NOTIFY_WEBHOOK_URL: z.url().optional().or(z.literal('')),
  SMTP_HOST: z.string().optional().or(z.literal('')),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().or(z.literal('')),
  SMTP_PASS: z.string().optional().or(z.literal('')),
  NOTIFY_EMAIL_FROM: z.string().optional().or(z.literal('')),
  NOTIFY_EMAIL_TO: z.string().optional().or(z.literal('')),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuração inválida (.env):');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

if (!isProd && env.ADMIN_TOKEN === 'dev-token-inseguro') {
  console.warn('[aviso] ADMIN_TOKEN não definido — usando token de desenvolvimento. Não use em produção.');
}

export const config = {
  env: env.NODE_ENV,
  isProd,
  port: env.PORT,
  trustProxy: env.TRUST_PROXY,
  publicUrl: env.PUBLIC_URL,
  adminToken: env.ADMIN_TOKEN,
  ipHashSalt: env.IP_HASH_SALT,
  dbPath: env.DB_PATH,
  eventosRetencaoDias: env.EVENTOS_RETENCAO_DIAS,
  notify: {
    webhookUrl: env.NOTIFY_WEBHOOK_URL || null,
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER || undefined,
          pass: env.SMTP_PASS || undefined,
          from: env.NOTIFY_EMAIL_FROM || env.SMTP_USER,
          to: env.NOTIFY_EMAIL_TO,
        }
      : null,
  },
};
