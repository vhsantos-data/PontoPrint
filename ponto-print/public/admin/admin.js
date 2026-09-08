(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = 'pp_admin_token';
  const LIMIT = 25;
  let offset = 0;
  let total = 0;

  const login = $('#login');
  const panel = $('#panel');
  const status = $('#status');
  const tokenInput = $('#token');

  const getToken = () => sessionStorage.getItem(KEY) || '';
  const headers = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

  const tipoLabel = {
    empresa: 'Empresa', evento: 'Evento', fotos: 'Fotos e impressões', personalizado: 'Personalizado', 'nao-sei': 'Não sabe ainda',
  };

  function fmtDate(iso) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }
  function fmtPhone(d) {
    const n = d.replace(/^55/, '');
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n;
  }

  function showPanel(on) {
    login.hidden = on;
    panel.hidden = !on;
    $('#logout').hidden = !on;
  }

  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  }

  function buildQuery() {
    const p = new URLSearchParams();
    const s = $('#f-status').value;
    const q = $('#f-q').value.trim();
    if (s) p.set('status', s);
    if (q) p.set('q', q);
    return p;
  }

  async function load() {
    const p = buildQuery();
    p.set('limit', LIMIT);
    p.set('offset', offset);
    setStatus('Carregando...');
    const res = await fetch(`/api/admin/leads?${p}`, { headers: headers() });
    if (res.status === 401) {
      sessionStorage.removeItem(KEY);
      showPanel(false);
      setStatus('');
      $('#login .field__err').textContent = 'Token inválido ou expirado.';
      $('#login .field__err').classList.add('is-visible');
      return;
    }
    if (!res.ok) return setStatus('Não foi possível carregar os pedidos.', true);

    const data = await res.json();
    total = data.total;
    render(data.rows);
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
      span.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      const b = document.createElement('b');
      b.textContent = v;
      span.appendChild(b);
      el.appendChild(span);
    }
  }

  // Tudo via textContent: nada do banco é interpretado como HTML.
  function render(rows) {
    const list = $('#list');
    list.textContent = '';
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'admin__empty';
      p.textContent = 'Nenhum pedido com esses filtros.';
      list.appendChild(p);
      return;
    }
    const tpl = $('#tpl-lead');
    for (const lead of rows) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.status = lead.status;
      node.querySelector('.lead-card__name').textContent = `#${lead.id} ${lead.nome}`;
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
        const res = await fetch(`/api/admin/leads/${lead.id}`, {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ status: sel.value }),
        });
        sel.disabled = false;
        if (!res.ok) {
          sel.value = lead.status;
          return setStatus('Não foi possível atualizar o status.', true);
        }
        lead.status = sel.value;
        node.dataset.status = sel.value;
        setStatus(`Pedido #${lead.id} marcado como ${sel.options[sel.selectedIndex].text.toLowerCase()}.`);
        const r = await fetch(`/api/admin/leads?limit=1`, { headers: headers() });
        if (r.ok) renderSummary((await r.json()).resumo);
      });
      list.appendChild(node);
    }
  }

  // CSV: baixa via fetch para poder mandar o token no header.
  $('#csv').addEventListener('click', async (ev) => {
    ev.preventDefault();
    const res = await fetch(`/api/admin/leads.csv?${buildQuery()}`, { headers: headers() });
    if (!res.ok) return setStatus('Não foi possível exportar.', true);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  login.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = $('#login .field__err');
    err.textContent = '';
    err.classList.remove('is-visible');
    sessionStorage.setItem(KEY, tokenInput.value.trim());
    tokenInput.value = '';
    showPanel(true);
    offset = 0;
    await load();
  });

  $('#logout').addEventListener('click', () => {
    sessionStorage.removeItem(KEY);
    showPanel(false);
  });
  $('#refresh').addEventListener('click', () => { offset = 0; load(); });
  $('#f-status').addEventListener('change', () => { offset = 0; load(); });
  let debounce;
  $('#f-q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { offset = 0; load(); }, 350); });
  $('#prev').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); load(); });
  $('#next').addEventListener('click', () => { offset += LIMIT; load(); });

  if (getToken()) { showPanel(true); load(); } else { showPanel(false); }
})();
