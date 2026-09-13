/**
 * Prepara as imagens do site: gira, recorta, redimensiona e comprime.
 *
 *   node scripts/preparar-imagens.mjs
 *
 * Lê os originais (fotos-dos-trabalhos/, marca-original/) e grava as versões
 * enxutas que o site publica em public/assets/. Rodar de novo é seguro:
 * sempre regera a partir do original, nunca em cima do resultado anterior.
 *
 * Usa o Chromium do Playwright como conversor — evita dependência nativa.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Fotos do portfólio: quadradas, porque os originais são quase todos verticais. */
const FOTOS = [
  { de: 'original-01.jpg', para: 'placas-ps.webp',        legenda: 'Placas em PS 2 mm' },
  { de: 'original-05.jpg', para: 'placas-sinalizacao.webp', legenda: 'Placas de sinalização', girar: 180, ajuste: 'conter', fundo: '#f4f4f1' },
  { de: 'original-10.jpg', para: 'adesivos.webp',         legenda: 'Adesivos e etiquetas' },
  { de: 'original-04.jpg', para: 'banners.webp',          legenda: 'Banners e wind banners' },
  { de: 'original-03.jpg', para: 'camisetas.webp',        legenda: 'Camisetas personalizadas' },
  { de: 'original-18.webp', para: 'canecas.webp',         legenda: 'Canecas personalizadas' },
  { de: 'original-19.webp', para: 'cadernos.webp',        legenda: 'Cadernos personalizados' },
  { de: 'original-16.jpg', para: 'brindes.webp',          legenda: 'Brindes e lembranças' },
];

/** Foto da loja, usada na seção de endereço (formato deitado). */
const LOJA = { de: 'original-20.webp', para: 'loja.webp', prop: 4 / 3, largura: 1000 };

/** Marca: mantém a proporção do original, só reduz e comprime. */
const MARCA = [
  { de: 'Logo_Ponto_Print-01.png', para: 'logo.png', largura: 900 },
  { de: 'Logo_Ponto_Print.png',    para: 'logo-negativo.png', largura: 900 },
  { de: 'Logo_Ponto_Print-08.png', para: 'monograma.png', largura: 512 },
];
/** Ícones de aba e de atalho, gerados do monograma. */
const ICONES = [
  { de: 'Logo_Ponto_Print-08.png', para: '../icone-180.png', largura: 180, fundo: '#ffffff', margem: 0.1 },
  { de: 'Logo_Ponto_Print-08.png', para: '../icone-32.png', largura: 32, fundo: '#ffffff', margem: 0.06 },
];

const dataUrl = (caminho) => {
  const tipo = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[extname(caminho).toLowerCase()];
  return `data:${tipo};base64,${readFileSync(caminho).toString('base64')}`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

/**
 * Desenha a imagem num canvas aplicando rotação, recorte e escala,
 * e devolve o binário já comprimido.
 */
async function processar(origem, { largura, prop, girar = 0, formato = 'image/webp', qualidade = 0.82, fundo = null, margem = 0, ajuste = 'cobrir' }) {
  const base64 = await page.evaluate(
    async ({ src, largura, prop, girar, formato, qualidade, fundo, margem, ajuste }) => {
      const img = new Image();
      img.src = src;
      await img.decode();

      // rotação de 90/270 troca largura por altura
      const vira = girar === 90 || girar === 270;
      const oW = vira ? img.height : img.width;
      const oH = vira ? img.width : img.height;

      // proporção de saída: a pedida, ou a do próprio original
      const alvo = prop || oW / oH;
      const altura = Math.round(largura / alvo);

      // 'cobrir' recorta para preencher; 'conter' encaixa a peça inteira
      const escala = ajuste === 'conter'
        ? Math.min(largura / oW, altura / oH)
        : Math.max(largura / oW, altura / oH);
      const dW = oW * escala;
      const dH = oH * escala;

      const c = document.createElement('canvas');
      c.width = largura;
      c.height = altura;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (fundo) { ctx.fillStyle = fundo; ctx.fillRect(0, 0, largura, altura); }

      const m = margem ? largura * margem : 0;
      ctx.save();
      ctx.translate(largura / 2, altura / 2);
      ctx.rotate((girar * Math.PI) / 180);
      if (margem) ctx.scale((largura - 2 * m) / largura, (altura - 2 * m) / altura);
      ctx.drawImage(img, vira ? -dH / 2 : -dW / 2, vira ? -dW / 2 : -dH / 2, vira ? dH : dW, vira ? dW : dH);
      ctx.restore();

      return c.toDataURL(formato, qualidade).split(',')[1];
    },
    { src: dataUrl(origem), largura, prop, girar, formato, qualidade, fundo, margem, ajuste },
  );
  return Buffer.from(base64, 'base64');
}

const kb = (b) => `${Math.round(b.length / 1024)} KB`;

mkdirSync(resolve(raiz, 'public/assets/portfolio'), { recursive: true });
mkdirSync(resolve(raiz, 'public/assets/marca'), { recursive: true });

console.log('Fotos do portfólio (quadradas, 1000px):');
for (const f of FOTOS) {
  const buf = await processar(resolve(raiz, 'fotos-dos-trabalhos', f.de), {
    largura: 1000, prop: 1, girar: f.girar, ajuste: f.ajuste, fundo: f.fundo,
  });
  writeFileSync(resolve(raiz, 'public/assets/portfolio', f.para), buf);
  console.log(`  ${f.para.padEnd(26)} ${kb(buf).padStart(7)}   ${f.legenda}`);
}

const bufLoja = await processar(resolve(raiz, 'fotos-dos-trabalhos', LOJA.de), { largura: LOJA.largura, prop: LOJA.prop });
writeFileSync(resolve(raiz, 'public/assets/portfolio', LOJA.para), bufLoja);
console.log(`\nLoja: ${LOJA.para} ${kb(bufLoja)}`);

console.log('\nMarca:');
for (const m of [...MARCA, ...ICONES]) {
  const buf = await processar(resolve(raiz, 'marca-original/logos', m.de), {
    largura: m.largura, formato: 'image/png', fundo: m.fundo, margem: m.margem,
  });
  writeFileSync(resolve(raiz, 'public/assets/marca', m.para), buf);
  console.log(`  ${m.para.replace('../', '').padEnd(26)} ${kb(buf).padStart(7)}`);
}

await browser.close();
console.log('\nPronto.');
