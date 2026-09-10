/**
 * Gera public/assets/og.png (1200x630) a partir de design/og.html.
 *
 *   npx playwright install chromium   # só na primeira vez
 *   node scripts/gerar-og.mjs
 *
 * Para usar a arte definitiva com foto de trabalho real, edite design/og.html
 * (é HTML/CSS comum) e rode de novo.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`file://${resolve(raiz, 'design/og.html')}`);
try {
  await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 15000 });
} catch {
  console.warn('Fontes não carregaram a tempo — gerando com a fonte de fallback.');
}
await page.screenshot({ path: resolve(raiz, 'public/assets/og.png') });
await browser.close();
console.log('public/assets/og.png gerado (1200x630).');
