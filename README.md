# Ponto Print

Site institucional e API de orçamentos da Ponto Print — gráfica rápida em
Osasco/SP.

## ⚠️ O projeto fica em `ponto-print/`

Não há `package.json` na raiz. Todo comando (`npm install`, `npm run dev`)
precisa ser rodado **dentro da pasta `ponto-print`**:

```bash
cd ponto-print
npm install
node scripts/preparar-env.mjs   # cria o .env e mostra o token do painel
npm run dev                     # http://localhost:3000
```

No GitHub Codespaces o terminal já abre nessa pasta e o preparo acontece
sozinho — veja o passo a passo em
[`ponto-print/README.md`](ponto-print/README.md).

## Documentação

| Arquivo | Para quê |
| --- | --- |
| [`ponto-print/README.md`](ponto-print/README.md) | Como rodar, publicar, estrutura, API, painel e segurança |
| [`ponto-print/PENDENCIAS.md`](ponto-print/PENDENCIAS.md) | O que ainda depende de confirmação antes de publicar (domínio, e-mail, logo, fotos) |
| [`ponto-print/public/js/config.js`](ponto-print/public/js/config.js) | Dados da loja: WhatsApp, endereço, horário, redes. É o arquivo do dia a dia |
