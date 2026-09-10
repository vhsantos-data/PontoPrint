/**
 * Cria o .env na primeira vez (Codespaces, devcontainer ou máquina nova).
 *
 *   node scripts/preparar-env.mjs
 *
 * Copia o .env.example e já gera ADMIN_TOKEN e IP_HASH_SALT de verdade,
 * para o painel não ficar com o token de desenvolvimento. Nunca sobrescreve
 * um .env existente.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(raiz, '.env');

if (existsSync(destino)) {
  console.log('.env já existe — nada a fazer.');
  process.exit(0);
}

const token = () => randomBytes(32).toString('base64url');
const adminToken = token();

const conteudo = readFileSync(resolve(raiz, '.env.example'), 'utf8')
  .replace(/^# ?ADMIN_TOKEN=.*$/m, `ADMIN_TOKEN=${adminToken}`)
  .replace(/^# ?IP_HASH_SALT=.*$/m, `IP_HASH_SALT=${token()}`);

writeFileSync(destino, conteudo, { mode: 0o600 });

console.log('.env criado com ADMIN_TOKEN e IP_HASH_SALT gerados.');
console.log(`\nToken do painel (/admin):\n  ${adminToken}\n`);
console.log('Ele fica salvo no .env, que não vai para o git.');
