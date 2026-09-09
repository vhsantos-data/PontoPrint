import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { closeDb, pruneEventos } from './db.js';
import { leadsRouter } from './routes/leads.js';
import { adminRouter } from './routes/admin.js';
import { eventosRouter } from './routes/eventos.js';
import { securityHeaders, forceHttps, cors, apiLimiter } from './middleware/security.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.set('etag', 'weak');

// ---- Segurança ----
app.use(forceHttps);
app.use(securityHeaders);
app.use(cors);

// ---- Log enxuto (método, rota, status, tempo). Sem corpo, sem IP em claro. ----
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const path = req.originalUrl.split('?')[0]; // capturado agora: dentro dos routers req.path muda
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (path.startsWith('/api') || res.statusCode >= 400) {
      console.log(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms`);
    }
  });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

// ---- API ----
app.use('/api', apiLimiter, express.json({ limit: '16kb' }));
app.use('/api', leadsRouter);
app.use('/api', eventosRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ---- Site estático ----
// HTML sempre revalida; CSS/JS/imagens podem ficar em cache (troque o nome do arquivo ao alterar,
// ou use ?v= nos links do index.html).
app.use(
  express.static(publicDir, {
    index: 'index.html',
    extensions: ['html'],
    setHeaders(res, path) {
      if (path.endsWith('.html')) res.set('Cache-Control', 'no-cache');
      else res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    },
  }),
);

app.use((_req, res) => res.status(404).sendFile(join(publicDir, '404.html')));

// ---- Erros: JSON na API, nada de stack para o cliente ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ erro: 'Corpo da requisição muito grande.' });
  console.error(err);
  if (req.path.startsWith('/api')) return res.status(500).json({ erro: 'Erro interno.' });
  res.status(500).sendFile(join(publicDir, '404.html'));
});

// Métricas brutas expiram; roda na subida e uma vez por dia.
const prune = () => {
  const n = pruneEventos(config.eventosRetencaoDias);
  if (n) console.log(`[metricas] ${n} eventos antigos removidos`);
};
prune();
setInterval(prune, 24 * 60 * 60 * 1000).unref();

const server = app.listen(config.port, () => {
  console.log(`Ponto Print rodando em http://localhost:${config.port} (${config.env})`);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido, encerrando...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
