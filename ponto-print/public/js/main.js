(() => {
  const cfg = window.PP_CONFIG || {};
  const msgs = cfg.mensagens || {};
  const wa = (msg) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg || '')}`;

  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const setText = (sel, valor) => $$(sel).forEach((el) => { el.textContent = valor || ''; });

  // Formata 5511919693833 -> (11) 91969-3833. Usa o rótulo do config quando existir.
  const telefoneVisivel = () => {
    if (cfg.whatsappLabel) return cfg.whatsappLabel;
    const d = String(cfg.whatsapp || '').replace(/^55/, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  };

  // ---- Métricas próprias: sem cookie, sem terceiros. Só "alguém abriu" e "alguém clicou em qual botão". ----
  const track = (tipo, extra = {}) => {
    try {
      const body = JSON.stringify({
        tipo,
        caminho: location.pathname,
        ref: document.referrer || '',
        utm: new URLSearchParams(location.search).get('utm_source') || '',
        ...extra,
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/evento', new Blob([body], { type: 'application/json' }));
      else fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* métrica nunca pode quebrar a página */ }
  };
  track('pageview');

  // ---- Links de WhatsApp: cada ponto da página abre a conversa já com contexto ----
  $$('[data-wa]').forEach((a) => {
    const key = a.dataset.wa;
    a.href = wa(msgs[key] || msgs.hero);
    a.target = '_blank';
    a.rel = 'noopener';
    a.addEventListener('click', () => track('cta', { rotulo: key }));
    if (a.hasAttribute('data-wa-label')) a.textContent = telefoneVisivel();
  });

  // ---- Dados da loja espalhados pela página ----
  setText('[data-endereco]', cfg.endereco);
  setText('[data-endereco-obs]', cfg.enderecoObs);
  setText('[data-horario]', cfg.horario);
  setText('[data-cnpj]', cfg.cnpj);
  setText('[data-atendente]', cfg.atendente ? `Atendimento com ${cfg.atendente}` : '');
  setText('[data-ano]', String(new Date().getFullYear()));

  $$('[data-maps]').forEach((a) => {
    if (cfg.mapsUrl) a.href = cfg.mapsUrl;
    else a.removeAttribute('href');
    a.addEventListener('click', () => track('cta', { rotulo: 'maps' }));
  });

  // Campos ainda não confirmados simplesmente não aparecem.
  const razao = document.querySelector('[data-razao-social]');
  if (razao) { razao.textContent = cfg.razaoSocial || ''; razao.hidden = !cfg.razaoSocial; }

  const emailRow = document.querySelector('[data-email-row]');
  if (emailRow && cfg.email) {
    const a = emailRow.querySelector('[data-email]');
    a.href = `mailto:${cfg.email}`;
    a.textContent = cfg.email;
    emailRow.hidden = false;
  }

  const socialRow = document.querySelector('[data-social-row]');
  if (socialRow) {
    const ig = socialRow.querySelector('[data-ig]');
    if (cfg.instagram) { ig.href = cfg.instagram; } else { ig.remove(); }
    if (cfg.facebook) {
      const dd = socialRow.querySelector('dd');
      const fb = document.createElement('a');
      fb.href = cfg.facebook;
      fb.target = '_blank';
      fb.rel = 'noopener';
      fb.textContent = 'Facebook';
      if (cfg.instagram) dd.append(' · ');
      dd.append(fb);
    }
    socialRow.hidden = !(cfg.instagram || cfg.facebook);
  }

  // ---- Botão flutuante: some na seção de contato, que já tem o próprio botão ----
  const float = document.querySelector('.wa-float');
  const contato = document.getElementById('contato');
  if (float && contato && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entrada]) => float.classList.toggle('is-hidden', entrada.isIntersecting),
      { threshold: 0 },
    ).observe(contato);
  }

  // ---- Menu mobile ----
  const top = document.querySelector('.top');
  const menuBtn = document.querySelector('.top__menu');
  menuBtn?.addEventListener('click', () => {
    const open = top.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $$('.top__nav a').forEach((a) =>
    a.addEventListener('click', () => { top.classList.remove('is-open'); menuBtn?.setAttribute('aria-expanded', 'false'); }),
  );

  // ---- Máscara leve no telefone ----
  const tel = document.getElementById('f-telefone');
  tel?.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`;
    tel.value = out;
  });

  // ---- Formulário ----
  const form = document.getElementById('form-orcamento');
  if (!form) return;

  form.querySelector('[name="t"]').value = String(Date.now());

  const status = form.querySelector('.form__status');
  const submitBtn = form.querySelector('[type="submit"]');

  // Precisa bater com TIPOS em server/routes/leads.js e com o painel.
  const tipoLabel = {
    placas: 'Placas e sinalização',
    adesivos: 'Adesivos e vinil',
    plotagem: 'Plotagem / grande formato',
    fotos: 'Impressão de fotos',
    impressao: 'Impressão e cópias (A4/A3)',
    grafica: 'Gráfica comercial',
    acabamento: 'Encadernação e acabamentos',
    personalizados: 'Produtos personalizados',
    arte: 'Criação / ajuste de arte',
    'nao-sei': 'Ainda não sei',
  };

  function clearErrors() {
    form.querySelectorAll('.field.is-invalid').forEach((f) => f.classList.remove('is-invalid'));
    form.querySelectorAll('.field__err').forEach((e) => { e.textContent = ''; e.classList.remove('is-visible'); });
    status.textContent = '';
    status.classList.remove('is-error');
  }

  function showErrors(campos) {
    let first = null;
    for (const [campo, msg] of Object.entries(campos)) {
      const input = form.elements[campo];
      if (!input) continue;
      const field = input.closest('.field');
      const err = field ? field.querySelector('.field__err') : form.querySelector('.field__err--consent');
      field?.classList.add('is-invalid');
      if (err) { err.textContent = msg; err.classList.add('is-visible'); }
      first ??= input;
    }
    first?.focus();
  }

  function validateLocal(data) {
    const erros = {};
    if (!data.nome || data.nome.trim().length < 2) erros.nome = 'Informe seu nome.';
    const dig = (data.telefone || '').replace(/\D/g, '');
    if (dig.length < 10) erros.telefone = 'Informe um WhatsApp válido com DDD.';
    if (!data.tipo) erros.tipo = 'Escolha o que você precisa.';
    if (!data.consentimento) erros.consentimento = 'Precisamos da sua autorização para entrar em contato.';
    return erros;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors();

    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.consentimento = fd.get('consentimento') === 'on';
    data.t = Number(data.t);

    const local = validateLocal(data);
    if (Object.keys(local).length) return showErrors(local);

    submitBtn.disabled = true;
    status.textContent = 'Enviando...';

    try {
      const res = await fetch('/api/orcamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 422 && body.campos) {
        status.textContent = body.erro || 'Confira os campos destacados.';
        status.classList.add('is-error');
        return showErrors(body.campos);
      }
      if (res.status === 429) {
        status.textContent = 'Você já enviou vários pedidos em pouco tempo. Aguarde alguns minutos ou chame no WhatsApp.';
        status.classList.add('is-error');
        return;
      }
      if (!res.ok) throw new Error(body.erro || `Erro ${res.status}`);

      // Sucesso: confirma na tela e monta a continuação no WhatsApp com o que a pessoa já digitou.
      const partes = [
        `Olá! Acabei de deixar um pedido de orçamento no site${body.id ? ` (nº ${body.id})` : ''}.`,
        `Nome: ${data.nome.trim()}`,
        `Preciso de: ${tipoLabel[data.tipo] || data.tipo}`,
        data.quantidade ? `Quantidade/medida: ${data.quantidade.trim()}` : null,
        data.mensagem?.trim() ? `Detalhes: ${data.mensagem.trim()}` : null,
      ].filter(Boolean);
      const doneWa = form.querySelector('#done-wa');
      doneWa.href = wa(partes.join('\n'));
      doneWa.addEventListener('click', () => track('cta', { rotulo: 'form-continuar' }), { once: true });
      form.classList.add('is-done');
      form.querySelector('.form__done').hidden = false;
      form.querySelector('.form__done h3').focus?.();
    } catch {
      status.textContent = 'Não conseguimos enviar agora. Tente de novo ou chame direto no WhatsApp.';
      status.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
