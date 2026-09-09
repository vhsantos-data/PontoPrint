(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = 'pp_admin_token';
  const LIMIT = 25;
  let offset = 0;
  let total = 0;
  let tab = 'geral';

  const login = $('#login');
  const status = $('#status');
  const tokenInput = $('#token');

  const getToken = () => sessionStorage.getItem(KEY) || '';
  const headers = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

  const tipoLabel = {
    empresa: 'Empresa', evento: 'Evento', fotos: 'Fotos e impressões', personalizado: 'Personalizado', 'nao-sei': 'Não sabe ainda',
  };
  const ctaLabel = {
    hero: 'Topo da página', empresa: 'Card "Para sua empresa"', evento: 'Card "Para seu evento"', fotos: 'Card "Impressões e fotos"',
    personalizado: 'Card "Projetos personalizados"', portfolio: 'Portfólio', ajuda: '"Preciso de ajuda"', final: 'Fechamento / rodapé',
    'form-continuar': 'Após enviar o formulário',
  };
  const statusLabel = { novo: 'Novo', contatado: 'Contatado', orcado: 'Orçado', fechado: 'Fechado', perdido: 'Perdido', spam: 'Spam' };

  const fmtDate = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtPhone = (d) => {
    const n = d.replace(/^55/, '');
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n;
  };
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '—');

  // ---------------- sessão / abas ----------------
  function showPanel(on) {
    login.hidden = on;
    $('#tabs').hidden = !on;
    $('#logout').hidden = !on;
    if (on) showTab(tab);
    else { $('#tab-geral').hidden = true; $('#tab-pedidos').hidden = true; }
  }

  function showTab(name) {
    tab = name;
    $('#tab-geral').hidden = name !== 'geral';
    $('#tab-pedidos').hidden = name !== 'pedidos';
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    if (name === 'geral') loadMetricas();
    else { offset = 0; loadLeads(); }
  }

  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: headers() });
    if (res.status === 401) {
      sessionStorage.removeItem(KEY);
      showPanel(false);
      const err = $('#login .field__err');
      err.textContent = 'Token inválido ou expirado.';
      err.classList.add('is-visible');
      throw new Error('401');
    }
    return res;
  }

  // ---------------- visão geral ----------------
  async function loadMetricas() {
    const dias = $('#f-dias').value;
    let m;
    try {
      const res = await api(`/api/admin/metricas?dias=${dias}`);
      if (!res.ok) throw new Error(res.status);
      m = await res.json();
    } catch (e) {
      if (e.message !== '401') $('#kpis').textContent = 'Não foi possível carregar as métricas.';
      return;
    }
    renderKpis(m);
    renderChart(m.serie);
    renderTable('#t-ctas', m.ctas.map((r) => [ctaLabel[r.rotulo] || r.rotulo, r.n]), 'Nenhum clique ainda.');
    renderTable('#t-origens', m.origens.map((r) => [r.origem, r.n]), 'Nenhuma visita ainda.');
    renderTable('#t-disp', m.dispositivos.map((r) => [r.dispositivo, r.n]), 'Nenhuma visita ainda.');
    renderTable('#t-tipos', m.pedidosPorTipo.map((r) => [tipoLabel[r.tipo] || r.tipo, r.n]), 'Nenhum pedido no período.');
    const funil = m.funil.map((r) => [statusLabel[r.status] || r.status, `${r.n} pedido${r.n === 1 ? '' : 's'}${r.valor ? ` · ${fmtBRL(r.valor)}` : ''}`]);
    renderTable('#t-funil', funil, 'Nenhum pedido no período.', false);
  }

  function kpi(label, value, sub, hoje = false) {
    const el = document.createElement('div');
    el.className = `kpi${hoje ? ' kpi--hoje' : ''}`;
    const s = document.createElement('small'); s.textContent = label;
    const b = document.createElement('b'); b.textContent = value;
    el.append(s, b);
    if (sub) { const sp = document.createElement('span'); sp.textContent = sub; el.appendChild(sp); }
    return el;
  }

  function renderKpis(m) {
    const k = $('#kpis');
    k.textContent = '';
    const p = m.periodo;
    const fechados = m.funil.find((r) => r.status === 'fechado');
    k.append(
      kpi('Visitantes hoje', m.hoje.visitantes, `${m.hoje.visitas} visita${m.hoje.visitas === 1 ? '' : 's'}`, true),
      kpi('Visitantes 7 dias', m.ultimos7.visitantes, `${m.ultimos7.cliques} cliques · ${m.ultimos7.pedidos} pedidos`),
      kpi(`Visitantes ${m.dias} dias`, p.visitantes, `${p.visitas} visitas`),
      kpi('Cliques no WhatsApp', p.cliques, `${pct(p.visitantes_clicaram, p.visitantes)} dos visitantes clicam`),
      kpi('Pedidos no site', p.pedidos, `${pct(p.pedidos, p.visitantes)} de conversão`),
      kpi('Fechados', fechados ? fechados.n : 0, fechados && fechados.valor ? fmtBRL(fechados.valor) : 'sem valor lançado'),
    );
  }

  function renderTable(sel, rows, emptyMsg, withBar = true) {
    const t = $(sel);
    t.textContent = '';
    if (!rows.length) {
      const tr = t.insertRow(); const td = tr.insertCell(); td.className = 'vazio'; td.textContent = emptyMsg; td.colSpan = 2;
      return;
    }
    const max = Math.max(...rows.map((r) => (typeof r[1] === 'number' ? r[1] : 0)), 1);
    for (const [label, n] of rows) {
      const tr = t.insertRow();
      const td1 = tr.insertCell(); td1.textContent = label;
      if (withBar && typeof n === 'number') { const bar = document.createElement('i'); bar.className = 'bar'; bar.style.width = `${(n / max) * 100}%`; td1.appendChild(bar); }
      const td2 = tr.insertCell(); td2.textContent = typeof n === 'number' ? n.toLocaleString('pt-BR') : n;
    }
  }

  // Gráfico em SVG puro: barras (visitantes e cliques) + pontos (pedidos).
  function renderChart(serie) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
    const W = 900, H = 220, padL = 30, padR = 8, padT = 12, padB = 26;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = serie.length;
    const max = Math.max(...serie.map((d) => Math.max(d.visitantes, d.cliques, d.pedidos)), 1);
    const y = (v) => padT + innerH - (v / max) * innerH;
    const slot = innerW / n;
    const barW = Math.max(2, Math.min(18, slot * 0.34));

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` });
    for (const frac of [0, 0.5, 1]) {
      const yy = y(max * frac);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: yy, y2: yy, class: 'axis' }));
      const t = el('text', { x: padL - 6, y: yy + 3, 'text-anchor': 'end' }); t.textContent = Math.round(max * frac); svg.appendChild(t);
    }
    const labelEvery = n > 45 ? 10 : n > 20 ? 5 : n > 10 ? 2 : 1;
    serie.forEach((d, i) => {
      const cx = padL + slot * i + slot / 2;
      const title = `${d.dia.split('-').reverse().join('/')}: ${d.visitantes} visitantes, ${d.cliques} cliques, ${d.pedidos} pedidos`;
      const g = el('g');
      const tt = el('title'); tt.textContent = title; g.appendChild(tt);
      g.appendChild(el('rect', { x: cx - barW - 1, y: y(d.visitantes), width: barW, height: innerH + padT - y(d.visitantes), class: 'bar-vis' }));
      g.appendChild(el('rect', { x: cx + 1, y: y(d.cliques), width: barW, height: innerH + padT - y(d.cliques), class: 'bar-cli' }));
      if (d.pedidos) g.appendChild(el('circle', { cx, cy: y(d.pedidos), r: 4, class: 'dot-ped' }));
      if (i % labelEvery === 0 || i === n - 1) {
        const t = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' });
        t.textContent = d.dia.slice(5).split('-').reverse().join('/');
        g.appendChild(t);
      }
      svg.appendChild(g);
    });
    if (!serie.some((d) => d.visitantes || d.cliques || d.pedidos)) {
      const t = el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'empty' });
      t.textContent = 'Sem visitas registradas neste período.';
      svg.appendChild(t);
    }
    const c = $('#chart'); c.textContent = ''; c.appendChild(svg);
  }

  // ---------------- pedidos ----------------
  function buildQuery() {
    const p = new URLSearchParams();
    const s = $('#f-status').value;
    const q = $('#f-q').value.trim();
    if (s) p.set('status', s);
    if (q) p.set('q', q);
    return p;
  }

  async function loadLeads() {
    const p = buildQuery();
    p.set('limit', LIMIT);
    p.set('offset', offset);
    setStatus('Carregando...');
    let data;
    try {
      const res = await api(`/api/admin/leads?${p}`);
      if (!res.ok) return setStatus('Não foi possível carregar os pedidos.', true);
      data = await res.json();
    } catch { return; }
    total = data.total;
    renderLeads(data.rows);
    renderSummary(data.resumo);
    $('#pageinfo').textContent = total ? `${offset + 1}–${Math.min(offset + LIMIT, total)} de ${total}` : '0 pedidos';
    $('#prev').disabled = offset === 0;
    $('#next').disabled = offset + LIMIT >= total;
    setStatus('');
  }

  function renderSummary(resumo) {
    const el = $('#summary');
    el.textContent = '';
    for (const [k, v] of Object.entries(resumo)) {
      const span = document.createElement('span');
      span.textContent = statusLabel[k] || k;
      const b = document.createElement('b'); b.textContent = v;
      span.appendChild(b);
      el.appendChild(span);
    }
  }

  async function patchLead(lead, body, node) {
    const res = await api(`/api/admin/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) { setStatus('Não foi possível salvar.', true); return null; }
    const { lead: novo } = await res.json();
    Object.assign(lead, novo);
    node.dataset.status = lead.status;
    return lead;
  }

  // Tudo via textContent: nada do banco é interpretado como HTML.
  function renderLeads(rows) {
    const list = $('#list');
    list.textContent = '';
    if (!rows.length) {
      const p = document.createElement('p'); p.className = 'admin__empty'; p.textContent = 'Nenhum pedido com esses filtros.';
      list.appendChild(p);
      return;
    }
    const tpl = $('#tpl-lead');
    for (const lead of rows) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.status = lead.status;
      node.querySelector('.lead-card__name').textContent = `#${lead.id} ${lead.nome}`;
      if (lead.valor) { const v = document.createElement('span'); v.className = 'lead-card__valor-tag'; v.textContent = fmtBRL(lead.valor); node.querySelector('.lead-card__name').appendChild(v); }
      node.querySelector('.lead-card__meta').textContent = `${fmtDate(lead.created_at)}${lead.origem ? ` (${lead.origem})` : ''}`;
      const wa = node.querySelector('.lead-card__wa');
      wa.textContent = fmtPhone(lead.telefone);
      wa.href = `https://wa.me/${lead.telefone}`;
      node.querySelector('.lead-card__email').textContent = lead.email || '—';
      node.querySelector('.lead-card__tipo').textContent = tipoLabel[lead.tipo] || lead.tipo;
      node.querySelector('.lead-card__qtd').textContent = lead.quantidade || '—';
      node.querySelector('.lead-card__msg').textContent = lead.mensagem || '';

      const sel = node.querySelector('.lead-card__status');
      sel.value = lead.status;
      sel.addEventListener('change', async () => {
        sel.disabled = true;
        const ok = await patchLead(lead, { status: sel.value }, node);
        sel.disabled = false;
        if (!ok) { sel.value = lead.status; return; }
        setStatus(`Pedido #${lead.id} marcado como ${statusLabel[lead.status].toLowerCase()}.`);
        const r = await api('/api/admin/leads?limit=1');
        if (r.ok) renderSummary((await r.json()).resumo);
      });

      const valorIn = node.querySelector('.lead-card__valor input');
      const obsIn = node.querySelector('.lead-card__obs textarea');
      valorIn.value = lead.valor ? Number(lead.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
      obsIn.value = lead.obs || '';
      node.querySelector('.lead-card__save').addEventListener('click', async (ev) => {
        ev.target.disabled = true;
        const ok = await patchLead(lead, { valor: valorIn.value.trim() || null, obs: obsIn.value.trim() || null }, node);
        ev.target.disabled = false;
        if (ok) {
          setStatus(`Pedido #${lead.id} salvo.`);
          const name = node.querySelector('.lead-card__name');
          name.textContent = `#${lead.id} ${lead.nome}`;
          if (lead.valor) { const v = document.createElement('span'); v.className = 'lead-card__valor-tag'; v.textContent = fmtBRL(lead.valor); name.appendChild(v); }
        }
      });
      list.appendChild(node);
    }
  }

  // CSV: baixa via fetch para poder mandar o token no header.
  $('#csv').addEventListener('click', async (ev) => {
    ev.preventDefault();
    let res;
    try { res = await api(`/api/admin/leads.csv?${buildQuery()}`); } catch { return; }
    if (!res.ok) return setStatus('Não foi possível exportar.', true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

  // ---------------- eventos ----------------
  login.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#login .field__err');
    err.textContent = ''; err.classList.remove('is-visible');
    sessionStorage.setItem(KEY, tokenInput.value.trim());
    tokenInput.value = '';
    showPanel(true);
  });
  $('#logout').addEventListener('click', () => { sessionStorage.removeItem(KEY); showPanel(false); });
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#f-dias').addEventListener('change', loadMetricas);
  $('#refresh').addEventListener('click', () => { offset = 0; loadLeads(); });
  $('#f-status').addEventListener('change', () => { offset = 0; loadLeads(); });
  let debounce;
  $('#f-q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { offset = 0; loadLeads(); }, 350); });
  $('#prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); loadLeads(); });
  $('#next').addEventListener('click', () => { offset += LIMIT; loadLeads(); });

  showPanel(Boolean(getToken()));
})();
