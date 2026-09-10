/* =========================================================
   Ponto Print — dados públicos do site.
   Editar SÓ este arquivo já atualiza a página inteira:
   botões de WhatsApp, rodapé, endereço, horário e link do mapa.
   Campos vazios ('') somem da página em vez de aparecer quebrados.
   ========================================================= */
window.PP_CONFIG = {
  // ---- Contato ----
  // Só dígitos, com DDI 55 + DDD. (11) 91969-3833
  whatsapp: '5511919693833',
  whatsappLabel: '(11) 91969-3833',
  atendente: 'Jadson',

  // A CONFIRMAR: e-mail oficial de pedidos. Sugestão levantada: pontoprintgr@gmail.com
  // Enquanto estiver vazio, a linha de e-mail não aparece no rodapé.
  email: '',

  // A CONFIRMAR: perfis ativos. Só preencher o que realmente será atualizado.
  instagram: '',
  facebook: '',

  // ---- Endereço e funcionamento ----
  endereco: 'Hilário Pereira de Souza, 492 — Jardins do Brasil, Osasco - SP',
  enderecoObs: 'Ponto comercial dentro do condomínio. Na primeira visita, chame no WhatsApp que orientamos a entrada.',
  regiao: 'Osasco e região',
  horario: 'Segunda a sexta, das 8h às 18h',
  // Busca pelo endereço. Trocar pelo link curto da ficha do Google Business quando ela estiver publicada.
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Hil%C3%A1rio+Pereira+de+Souza%2C+492+-+Osasco+-+SP',

  // ---- Dados legais (rodapé) ----
  cnpj: '48.841.667/0001-43',
  // A CONFIRMAR: razão social exatamente como consta no cartão CNPJ.
  razaoSocial: '',

  // ---- Mensagens já preenchidas em cada botão de WhatsApp ----
  // A chave é o valor de data-wa="..." no HTML.
  mensagens: {
    hero: 'Olá! Quero pedir um orçamento na Ponto Print.',
    placas: 'Olá! Quero orçamento de placa de sinalização personalizada.',
    adesivos: 'Olá! Quero orçamento de adesivo em vinil.',
    plotagem: 'Olá! Preciso de plotagem / impressão em grande formato (A2, A1 ou A0).',
    fotos: 'Olá! Quero imprimir fotos.',
    impressao: 'Olá! Preciso de impressão A4/A3 (colorida ou preto e branco).',
    grafica: 'Olá! Preciso de material gráfico (cartões, panfletos, folders...).',
    encadernacao: 'Olá! Preciso de encadernação / acabamento.',
    personalizados: 'Olá! Quero um produto personalizado (caneca, camiseta, caderno, brinde...).',
    arte: 'Olá! Preciso de ajuda com a arte / arquivo para impressão.',
    empresa: 'Olá! Preciso de materiais para a minha empresa.',
    evento: 'Olá! Preciso de materiais personalizados para um evento.',
    portfolio: 'Olá! Vi um trabalho no site da Ponto Print e quero algo parecido.',
    ajuda: 'Olá! Não sei exatamente qual material preciso — podem me ajudar?',
    arquivo: 'Olá! Posso mandar meu arquivo por aqui para orçamento?',
    endereco: 'Olá! Vou até a loja. Podem me orientar sobre a entrada?',
    flutuante: 'Olá! Quero pedir um orçamento na Ponto Print.',
    final: 'Olá! Quero pedir um orçamento na Ponto Print.',
  },
};
