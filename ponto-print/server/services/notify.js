import { config } from '../config.js';

let transporter = null;

async function getTransporter() {
  if (!config.notify.smtp) return null;
  if (transporter) return transporter;
  const nodemailer = await import('nodemailer');
  const { host, port, user, pass } = config.notify.smtp;
  transporter = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
  return transporter;
}

async function sendWebhook(lead) {
  if (!config.notify.webhookUrl) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(config.notify.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'PontoPrint-Site/1.0' },
      body: JSON.stringify({ evento: 'novo_orcamento', lead }),
      signal: controller.signal,
    });
    if (!res.ok) console.warn(`[notify] webhook respondeu ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

async function sendEmail(lead) {
  const t = await getTransporter();
  if (!t || !config.notify.smtp.to) return;
  const linhas = [
    `Nome: ${lead.nome}`,
    `WhatsApp: ${lead.telefone}`,
    lead.email ? `E-mail: ${lead.email}` : null,
    `Tipo: ${lead.tipo}`,
    lead.quantidade ? `Quantidade: ${lead.quantidade}` : null,
    lead.origem ? `Origem no site: ${lead.origem}` : null,
    '',
    lead.mensagem || '(sem descrição)',
  ].filter((l) => l !== null);

  await t.sendMail({
    from: config.notify.smtp.from,
    to: config.notify.smtp.to,
    subject: `Novo orçamento #${lead.id} — ${lead.nome}`,
    text: linhas.join('\n'), // texto puro: nada do usuário vira HTML
  });
}

/** Dispara notificações sem travar a resposta ao cliente. Falha aqui não falha o pedido. */
export function notifyNewLead(lead) {
  // Não envia dados técnicos (ip_hash, user_agent) para fora.
  const { ip_hash, user_agent, ...safe } = lead;
  Promise.allSettled([sendWebhook(safe), sendEmail(safe)]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') console.error('[notify] falha:', r.reason?.message || r.reason);
    }
  });
}
