// ---------- Helpers de formatação (compartilhados pelos 4 tipos de documento) ----------

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function formatarDataBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatarDataExtenso(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
}

function formatarHora(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`;
}

function formatarMoeda(num) {
  const n = isFinite(num) ? num : 0;
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function joinComE(arr) {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
}

// Une cláusulas com vírgulas internas (nome, CPF, parentesco) — "; e" evita
// ambiguidade que "e" simples causaria entre cláusulas longas.
function joinClausulas(arr) {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join('; ') + '; e ' + arr[arr.length - 1];
}

function modalidadeTextoDeclaracao(modalidade) {
  return modalidade === 'online' ? 'por telepsicologia' : 'presencial';
}

function respsPreenchidos(responsaveis) {
  return (responsaveis || []).filter(r => r.nome && r.nome.trim());
}

// ---------- Especificação dos 4 tipos de documento ----------
// `shell`: 'teal' (recibo, cartão de marca) ou 'letterhead' (timbrado branco).
// `campos`: usados pra montar o formulário dinâmico em app.js.
//   fonte 'paciente' = pré-preenche do cadastro, editável no momento de gerar.
//   fonte 'doc' = sempre específico deste documento (não vem do cadastro).

const TIPOS_DOCUMENTO = {

  recibo: {
    label: 'Recibo',
    shell: 'teal',
    campos: [
      { id: 'valorSessao', label: 'Valor por sessão (R$)', tipo: 'number', fonte: 'paciente', default: 0 },
      { id: 'datas', label: 'Datas das sessões', tipo: 'lista-data', fonte: 'doc', default: [''] },
      { id: 'cidade', label: 'Cidade', tipo: 'text', fonte: 'paciente', default: 'Brasília' },
      { id: 'dataDocumento', label: 'Data do recibo', tipo: 'date', fonte: 'doc', default: () => new Date().toISOString().slice(0, 10) },
    ],
    montar(paciente, perfil, c) {
      const datasValidas = (c.datas || []).filter(d => d);
      const n = datasValidas.length;
      const sessaoWord = n === 1 ? 'sessão' : 'sessões';
      const realizadaWord = n === 1 ? 'realizada' : 'realizadas';
      const diaWord = n === 1 ? 'no dia' : 'nos dias';
      const datasTexto = joinComE(datasValidas.map(formatarDataBR));
      const valorTotal = (parseFloat(c.valorSessao) || 0) * n;

      const temResponsavel = paciente.isMenor && respsPreenchidos(paciente.responsaveis).length > 0;
      const resp = temResponsavel ? paciente.responsaveis[0] : null;

      let texto = `Eu, ${perfil.nome || '[seu nome]'}, inscrito no CPF sob o n° ${perfil.cpf || '[seu CPF]'}, recebi de `;
      if (temResponsavel) {
        texto += `${resp.nome}, inscrito no CPF sob o n° ${resp.cpf || '[CPF do responsável]'}, responsável por ${paciente.nome || '[nome do paciente]'}`;
      } else {
        texto += `${paciente.nome || '[nome do paciente]'}, inscrito no CPF sob o n° ${paciente.cpf || '[CPF do paciente]'}`;
      }
      texto += `, a importância de ${formatarMoeda(valorTotal)} referente a ${n} ${sessaoWord} de psicoterapia individual ${realizadaWord}`;
      texto += n > 0 ? ` ${diaWord} ${datasTexto}.` : '.';

      return {
        titulo: 'Recibo',
        corpo: [texto],
        localData: `${c.cidade || '[cidade]'}, ${c.dataDocumento ? formatarDataExtenso(c.dataDocumento) : '[data]'}.`,
        assinaturas: [{ nome: perfil.nome || '[seu nome]', sub: `CRP: ${perfil.crp || '[seu CRP]'}` }],
      };
    },
  },

  declaracao: {
    label: 'Declaração de Comparecimento',
    shell: 'letterhead',
    campos: [
      { id: 'data', label: 'Data da sessão', tipo: 'date', fonte: 'doc', default: '' },
      { id: 'horaInicio', label: 'Início', tipo: 'time', fonte: 'doc', default: '' },
      { id: 'horaFim', label: 'Término', tipo: 'time', fonte: 'doc', default: '' },
      { id: 'modalidade', label: 'Modalidade', tipo: 'modalidade', fonte: 'paciente', default: 'presencial' },
      { id: 'cidade', label: 'Cidade', tipo: 'text', fonte: 'paciente', default: 'Brasília' },
      { id: 'dataDocumento', label: 'Data de emissão', tipo: 'date', fonte: 'doc', default: () => new Date().toISOString().slice(0, 10) },
    ],
    montar(paciente, perfil, c) {
      const modalidadeTexto = modalidadeTextoDeclaracao(c.modalidade);
      const resp = paciente.isMenor ? respsPreenchidos(paciente.responsaveis)[0] : null;
      const acompanhado = resp ? `, acompanhado(a) por ${resp.nome},` : '';
      const hi = formatarHora(c.horaInicio);
      const hf = formatarHora(c.horaFim);
      let horario = '';
      if (hi && hf) horario = `, no horário das ${hi} às ${hf}`;
      else if (hi) horario = `, com início às ${hi}`;
      const dataTexto = c.data ? formatarDataBR(c.data) : '[data]';

      const p1 = `Declaro, para os devidos fins, que ${paciente.nome || '[nome do paciente]'}${acompanhado} esteve em atendimento psicológico ${modalidadeTexto} comigo no dia ${dataTexto}${horario}.`;
      const p2 = 'Este documento tem finalidade exclusiva de comprovação de comparecimento, não contendo informações de natureza clínica ou diagnóstica.';

      return {
        titulo: 'Declaração de Comparecimento',
        corpo: [p1, p2],
        localData: `${c.cidade || '[cidade]'}, ${c.dataDocumento ? formatarDataExtenso(c.dataDocumento) : '[data]'}.`,
        assinaturas: [{ nome: perfil.nome || '[seu nome]', sub: `CRP: ${perfil.crp || '[seu CRP]'}` }],
      };
    },
  },

  comprovante: {
    label: 'Comprovante de Atendimento Psicoterapêutico',
    shell: 'letterhead',
    campos: [
      { id: 'dataInicio', label: 'Início do acompanhamento', tipo: 'date', fonte: 'paciente', default: '' },
      { id: 'frequencia', label: 'Frequência das sessões', tipo: 'text', fonte: 'paciente', default: 'semanal' },
      { id: 'modalidade', label: 'Modalidade', tipo: 'modalidade', fonte: 'paciente', default: 'presencial' },
      { id: 'encerrado', label: 'Acompanhamento já encerrado', tipo: 'checkbox', fonte: 'doc', default: false },
      { id: 'dataFim', label: 'Data de encerramento', tipo: 'date', fonte: 'doc', default: '', dependeDe: 'encerrado' },
      { id: 'cidade', label: 'Cidade', tipo: 'text', fonte: 'paciente', default: 'Brasília' },
      { id: 'dataDocumento', label: 'Data de emissão', tipo: 'date', fonte: 'doc', default: () => new Date().toISOString().slice(0, 10) },
    ],
    montar(paciente, perfil, c) {
      const modalidadeTexto = modalidadeTextoDeclaracao(c.modalidade);
      const resp = paciente.isMenor ? respsPreenchidos(paciente.responsaveis)[0] : null;
      const acompanhado = resp ? `, sob responsabilidade de ${resp.nome},` : '';
      const nomePac = paciente.nome || '[nome do paciente]';
      const inicio = c.dataInicio ? formatarDataBR(c.dataInicio) : '[data de início]';
      const freq = (c.frequencia && c.frequencia.trim()) ? c.frequencia.trim() : '[frequência]';

      let p1;
      if (c.encerrado) {
        const fim = c.dataFim ? formatarDataBR(c.dataFim) : '[data de encerramento]';
        p1 = `Declaro, para os devidos fins, que ${nomePac}${acompanhado} esteve em acompanhamento psicoterapêutico comigo no período de ${inicio} a ${fim}, ${modalidadeTexto}, com sessões de frequência ${freq}.`;
      } else {
        p1 = `Declaro, para os devidos fins, que ${nomePac}${acompanhado} está em acompanhamento psicoterapêutico comigo desde ${inicio}, ${modalidadeTexto}, com sessões de frequência ${freq}.`;
      }
      const p2 = 'Este documento tem finalidade exclusiva de comprovação do acompanhamento psicoterapêutico, não contendo informações de natureza clínica ou diagnóstica.';

      return {
        titulo: 'Comprovante de Atendimento Psicoterapêutico',
        corpo: [p1, p2],
        localData: `${c.cidade || '[cidade]'}, ${c.dataDocumento ? formatarDataExtenso(c.dataDocumento) : '[data]'}.`,
        assinaturas: [{ nome: perfil.nome || '[seu nome]', sub: `CRP: ${perfil.crp || '[seu CRP]'}` }],
      };
    },
  },

  termo: {
    label: 'Termo de Consentimento (menor de idade)',
    shell: 'letterhead',
    campos: [
      { id: 'modalidade', label: 'Modalidade', tipo: 'modalidade', fonte: 'paciente', default: 'presencial' },
      { id: 'frequencia', label: 'Frequência', tipo: 'text', fonte: 'paciente', default: 'semanal' },
      { id: 'duracaoSessao', label: 'Duração da sessão', tipo: 'text', fonte: 'paciente', default: 'até 50 minutos' },
      { id: 'valorSessao', label: 'Valor por sessão (R$) — opcional', tipo: 'number', fonte: 'paciente', default: '' },
      { id: 'politica', label: 'Política de cancelamento/remarcação — opcional', tipo: 'textarea', fonte: 'doc', default: '' },
      { id: 'cidade', label: 'Cidade', tipo: 'text', fonte: 'paciente', default: 'Brasília' },
      { id: 'dataDocumento', label: 'Data do termo', tipo: 'date', fonte: 'doc', default: () => new Date().toISOString().slice(0, 10) },
    ],
    somenteMenores: true,
    montar(paciente, perfil, c) {
      const resps = respsPreenchidos(paciente.responsaveis);
      const pacNome = paciente.nome || '[nome do(a) paciente]';
      const nasc = paciente.dataNascimento ? formatarDataBR(paciente.dataNascimento) : '[data de nascimento]';
      const profNome = perfil.nome || '[seu nome]';
      const profCrp = perfil.crp || '[seu CRP]';

      const listaBase = resps.length ? resps : [{ nome: '[nome do responsável]', cpf: '', parentesco: '' }];
      const partes = listaBase.map(r => {
        const cpf = (r.cpf && r.cpf.trim()) ? r.cpf.trim() : '[CPF]';
        const parentesco = (r.parentesco && r.parentesco.trim()) ? r.parentesco.trim() : '[parentesco]';
        return `${r.nome}, portador(a) do CPF n° ${cpf}, na qualidade de ${parentesco}`;
      });
      const sujeito = listaBase.length === 1 ? 'Eu' : 'Nós';
      const verbo = listaBase.length === 1 ? 'autorizo' : 'autorizamos';

      const abertura = `${sujeito}, ${joinClausulas(partes)}, de ${pacNome}, nascido(a) em ${nasc}, ${verbo} o acompanhamento psicoterapêutico de ${pacNome} pelo psicólogo ${profNome}, CRP ${profCrp}, mediante as condições descritas a seguir.`;

      const modalidadeTexto = c.modalidade === 'online'
        ? 'por telepsicologia, nos termos da Resolução CFP n° 011/2018'
        : `presencialmente, em ${c.cidade || '[cidade]'}`;
      const freq = (c.frequencia && c.frequencia.trim()) ? c.frequencia.trim() : '[frequência]';
      const duracao = (c.duracaoSessao && c.duracaoSessao.trim()) ? c.duracaoSessao.trim() : '[duração]';
      const valorNum = parseFloat(c.valorSessao);
      const valorClause = (c.valorSessao !== '' && c.valorSessao != null && !isNaN(valorNum) && valorNum > 0) ? `, ao valor de ${formatarMoeda(valorNum)} por sessão` : '';
      const politica = (c.politica && c.politica.trim()) ? ` ${c.politica.trim()}` : '';
      const condicoes = `O atendimento será realizado ${modalidadeTexto}, com frequência ${freq}, em sessões de ${duracao}${valorClause}.${politica}`;

      const plural = resps.length > 1;
      const fechamento = plural
        ? `Declaramos que lemos e compreendemos as informações acima e, de forma livre e esclarecida, autorizamos o atendimento psicoterapêutico de ${pacNome}.`
        : `Declaro que li e compreendi as informações acima e, de forma livre e esclarecida, autorizo o atendimento psicoterapêutico de ${pacNome}.`;

      const assinaturas = [{ nome: perfil.nome || '[seu nome]', sub: `CRP: ${perfil.crp || '[seu CRP]'}` }];
      (listaBase).forEach(r => assinaturas.push({ nome: r.nome, sub: 'Responsável' }));

      return {
        titulo: 'Termo de Consentimento Livre e Esclarecido',
        subtitulo: 'Atendimento psicoterapêutico de criança ou adolescente',
        abertura,
        clausulas: [
          { titulo: '1. Da natureza do atendimento', texto: 'O atendimento psicoterapêutico oferecido segue a abordagem psicanalítica. Trata-se de um processo construído ao longo do tempo, cujos resultados dependem do engajamento do(a) paciente e não podem ser garantidos quanto a prazo ou desfecho.' },
          { titulo: '2. Do sigilo profissional', texto: 'O conteúdo das sessões é protegido por sigilo profissional, nos termos do Código de Ética Profissional do Psicólogo. Aos responsáveis serão compartilhadas apenas informações gerais sobre o andamento do processo terapêutico — como objetivos, estratégias de trabalho e evolução geral —, preservando-se o espaço de fala do(a) paciente. O sigilo poderá ser rompido nas hipóteses previstas em lei ou no Código de Ética, como risco iminente à vida ou à integridade física, determinação judicial ou dever legal de comunicação.' },
          { titulo: '3. Do prontuário', texto: 'Os registros do atendimento são mantidos em prontuário psicológico, conforme a Resolução CFP n° 001/2009, pelo prazo mínimo de 5 (cinco) anos, com acesso assegurado ao responsável legal mediante solicitação formal.' },
          { titulo: '4. Da proteção de dados (LGPD)', texto: 'Os dados pessoais coletados são utilizados exclusivamente para os fins do atendimento psicoterapêutico, armazenados de forma segura, e não são compartilhados com terceiros sem autorização, ressalvadas as exceções legais. É assegurado ao titular dos dados o direito de acesso, correção e exclusão, nos termos da Lei n° 13.709/2018 (Lei Geral de Proteção de Dados).' },
          { titulo: '5. Da modalidade e das condições de atendimento', texto: condicoes },
          { titulo: '6. Do direito de interrupção', texto: 'O atendimento poderá ser interrompido a qualquer momento, por iniciativa do responsável ou do(a) paciente, sem qualquer prejuízo ou penalidade.' },
        ],
        fechamento,
        localData: `${c.cidade || '[cidade]'}, ${c.dataDocumento ? formatarDataExtenso(c.dataDocumento) : '[data]'}.`,
        assinaturas,
      };
    },
  },

  contrato: {
    label: 'Contrato de Prestação de Serviço',
    shell: 'letterhead',
    campos: [
      { id: 'modalidade', label: 'Modalidade', tipo: 'modalidade', fonte: 'paciente', default: 'presencial' },
      { id: 'frequencia', label: 'Frequência das sessões', tipo: 'text', fonte: 'paciente', default: 'semanal' },
      { id: 'duracaoSessao', label: 'Duração da sessão', tipo: 'text', fonte: 'paciente', default: 'até 50 minutos' },
      { id: 'valorSessao', label: 'Valor por sessão (R$)', tipo: 'number', fonte: 'paciente', default: 0 },
      { id: 'estruturaPagamento', label: 'Estrutura de pagamento', tipo: 'select', fonte: 'doc', default: 'mensal', opcoes: [['mensal', 'Mensal (por sessões realizadas)'], ['pacote', 'Pacote de sessões (pago antecipadamente)']] },
      { id: 'condicaoPagamento', label: 'Prazo de pagamento', tipo: 'select', fonte: 'doc', default: 'fim_mes', dependeDe: 'estruturaPagamento', dependeValor: 'mensal', opcoes: [['sessao', 'A cada sessão realizada'], ['fim_mes', 'Ao final de cada mês'], ['quinto_util', 'Até o 5º dia útil do mês subsequente']] },
      { id: 'pacoteSessoes', label: 'Nº de sessões no pacote', tipo: 'number', fonte: 'doc', default: 4, dependeDe: 'estruturaPagamento', dependeValor: 'pacote' },
      { id: 'pacoteValor', label: 'Valor total do pacote (R$)', tipo: 'number', fonte: 'doc', default: 0, dependeDe: 'estruturaPagamento', dependeValor: 'pacote' },
      { id: 'formaPagamento', label: 'Forma de pagamento', tipo: 'text', fonte: 'doc', default: 'Pix ou transferência bancária' },
      { id: 'antecedenciaRemarcacao', label: 'Antecedência mínima p/ remarcação', tipo: 'text', fonte: 'doc', default: 'uma semana' },
      { id: 'cidade', label: 'Cidade', tipo: 'text', fonte: 'paciente', default: 'Brasília' },
      { id: 'dataDocumento', label: 'Data do contrato', tipo: 'date', fonte: 'doc', default: () => new Date().toISOString().slice(0, 10) },
    ],
    montar(paciente, perfil, c) {
      const pacNome = paciente.nome || '[nome do(a) paciente]';
      const profNome = perfil.nome || '[seu nome]';
      const profCpf = perfil.cpf || '[seu CPF]';
      const profCrp = perfil.crp || '[seu CRP]';

      const contratanteIsResp = paciente.isMenor;
      const resps = contratanteIsResp ? respsPreenchidos(paciente.responsaveis) : [];
      const listaBase = contratanteIsResp
        ? (resps.length ? resps : [{ nome: '[nome do responsável]', cpf: '', parentesco: '' }])
        : [];
      const denominacao = contratanteIsResp && listaBase.length > 1 ? 'CONTRATANTES' : 'CONTRATANTE';
      const prep = denominacao === 'CONTRATANTES' ? 'aos(às)' : 'ao(à)';

      let contratanteQualificacao;
      if (contratanteIsResp) {
        const partes = listaBase.map(r => {
          const cpf = (r.cpf && r.cpf.trim()) ? r.cpf.trim() : '[CPF]';
          const parentesco = (r.parentesco && r.parentesco.trim()) ? r.parentesco.trim() : '[parentesco]';
          return `${r.nome}, portador(a) do CPF n° ${cpf}, na qualidade de ${parentesco} de ${pacNome}`;
        });
        contratanteQualificacao = joinClausulas(partes);
      } else {
        const cpfPac = (paciente.cpf && paciente.cpf.trim()) ? paciente.cpf.trim() : '[CPF]';
        contratanteQualificacao = `${pacNome}, portador(a) do CPF n° ${cpfPac}`;
      }

      const abertura = `Pelo presente instrumento particular de prestação de serviços psicológicos, de um lado ${profNome}, portador(a) do CPF n° ${profCpf}, inscrito(a) no CRP ${profCrp}, doravante denominado(a) CONTRATADO(A), e de outro lado ${contratanteQualificacao}, doravante denominado(a) ${denominacao}, têm entre si justo e acordado o presente contrato de prestação de serviços psicoterapêuticos, que se regerá pelas cláusulas a seguir.`;

      const modalidadeTexto = c.modalidade === 'online'
        ? 'por telepsicologia, nos termos da Resolução CFP n° 011/2018'
        : `de forma presencial, em ${c.cidade || '[cidade]'}`;
      const freq = (c.frequencia && c.frequencia.trim()) ? c.frequencia.trim() : '[frequência]';
      const duracao = (c.duracaoSessao && c.duracaoSessao.trim()) ? c.duracaoSessao.trim() : '[duração]';
      const valorTexto = formatarMoeda(parseFloat(c.valorSessao) || 0);
      const formaPagamento = (c.formaPagamento && c.formaPagamento.trim()) ? c.formaPagamento.trim() : '[forma de pagamento]';
      const antecedencia = (c.antecedenciaRemarcacao && c.antecedenciaRemarcacao.trim()) ? c.antecedenciaRemarcacao.trim() : '[antecedência]';

      const CONDICAO_PAGAMENTO_TEXTO = {
        sessao: 'a cada sessão realizada',
        fim_mes: 'ao final de cada mês, referente às sessões realizadas no período',
        quinto_util: 'até o 5º (quinto) dia útil do mês subsequente às sessões realizadas',
      };
      const isPacote = c.estruturaPagamento === 'pacote';
      let honorariosTexto;
      if (isPacote) {
        const numSessoes = parseInt(c.pacoteSessoes, 10) || 0;
        const valorPacoteTexto = formatarMoeda(parseFloat(c.pacoteValor) || 0);
        honorariosTexto = `O atendimento poderá ser contratado por pacote de ${numSessoes} sessões, no valor total de ${valorPacoteTexto}, pago antecipadamente por meio de ${formaPagamento}. O valor unitário de referência por sessão é de ${valorTexto}. Em observância ao art. 4º do Código de Ética Profissional do Psicólogo, o valor foi comunicado ${prep} ${denominacao} previamente ao início do atendimento, considerando a justa retribuição pelos serviços prestados.`;
      } else {
        const condicaoTexto = CONDICAO_PAGAMENTO_TEXTO[c.condicaoPagamento] || '[condição de pagamento]';
        honorariosTexto = `O valor de cada sessão é de ${valorTexto}. O pagamento será realizado ${condicaoTexto}, por meio de ${formaPagamento}. Em observância ao art. 4º do Código de Ética Profissional do Psicólogo, o valor foi comunicado ${prep} ${denominacao} previamente ao início do atendimento, considerando a justa retribuição pelos serviços prestados.`;
      }

      const assinaturas = [{ nome: perfil.nome || '[seu nome]', sub: `CRP: ${perfil.crp || '[seu CRP]'} — CONTRATADO(A)` }];
      if (contratanteIsResp) {
        listaBase.forEach(r => assinaturas.push({ nome: r.nome, sub: `CONTRATANTE${r.parentesco ? ' — ' + r.parentesco : ''}` }));
      } else {
        assinaturas.push({ nome: pacNome, sub: 'CONTRATANTE' });
      }

      return {
        titulo: 'Contrato de Prestação de Serviço',
        subtitulo: 'Prestação de serviços psicoterapêuticos',
        abertura,
        clausulas: [
          { titulo: '1. Do objeto', texto: `O presente contrato tem por objeto a prestação de serviços de psicoterapia individual, em abordagem psicanalítica, pelo(a) CONTRATADO(A) ao(à) paciente ${pacNome}, observados os princípios técnicos, éticos e científicos da profissão.` },
          { titulo: '2. Do atendimento', texto: `Cada sessão terá duração de ${duracao}, com frequência ${freq}, realizada ${modalidadeTexto}. Os dias e horários serão previamente combinados entre as partes, podendo ser ajustados conforme a disponibilidade de agenda de ambos.` },
          { titulo: '3. Da duração do acompanhamento', texto: 'A duração total do acompanhamento psicoterapêutico é variável e depende de fatores próprios de cada processo, não sendo possível determinar previamente prazo ou número total de sessões necessárias.' },
          { titulo: '4. Dos honorários e da forma de pagamento', texto: honorariosTexto },
          { titulo: '5. Do reajuste de valores', texto: `Os valores estabelecidos neste contrato poderão ser reajustados semestralmente, a cada 6 (seis) meses contados da data de assinatura deste instrumento, com base na variação acumulada do IPCA (Índice Nacional de Preços ao Consumidor Amplo) no período, ou outro índice que vier a substituí-lo. Qualquer reajuste será comunicado ${prep} ${denominacao} com antecedência mínima de 30 (trinta) dias, podendo as partes, de comum acordo, pactuar valor diverso do índice de referência.` },
          { titulo: '6. Das faltas e remarcações', texto: `Remarcações devem ser comunicadas ao(à) CONTRATADO(A) com antecedência mínima de ${antecedencia}. Remarcações comunicadas fora desse prazo estarão sujeitas à disponibilidade de agenda do(a) CONTRATADO(A), podendo não ser possível a reposição da sessão. Faltas são sempre cobradas integralmente, tendo em vista a reserva exclusiva do horário na agenda do(a) CONTRATADO(A). Em caso de cancelamento por iniciativa do(a) CONTRATADO(A), a sessão será reagendada sempre que possível; não sendo possível a remarcação, o valor da sessão não será cobrado.` },
          { titulo: '7. Do sigilo profissional', texto: 'O conteúdo das sessões é protegido por sigilo profissional, nos termos dos artigos 9º e 10 do Código de Ética Profissional do Psicólogo. O sigilo poderá ser rompido nas hipóteses previstas em lei ou no Código de Ética, como risco iminente à vida ou à integridade física, determinação judicial ou dever legal de comunicação.' },
          { titulo: '8. Do prontuário psicológico', texto: `Os registros do atendimento são mantidos em prontuário psicológico, conforme a Resolução CFP n° 001/2009, pelo prazo mínimo de 5 (cinco) anos, com acesso assegurado ${prep} ${denominacao} mediante solicitação formal.` },
          { titulo: '9. Da proteção de dados pessoais (LGPD)', texto: 'Os dados pessoais coletados são utilizados exclusivamente para os fins do atendimento psicoterapêutico, armazenados de forma segura, e não são compartilhados com terceiros sem autorização, ressalvadas as exceções legais. É assegurado o direito de acesso, correção e exclusão dos dados, nos termos da Lei n° 13.709/2018 (Lei Geral de Proteção de Dados).' },
          { titulo: '10. Da vigência e rescisão', texto: 'O presente contrato vigora por prazo indeterminado, enquanto durar o acompanhamento psicoterapêutico, podendo ser rescindido a qualquer momento por iniciativa de qualquer das partes, sem ônus ou penalidade, respeitado o pagamento das sessões já realizadas.' },
        ],
        fechamento: 'E, por estarem assim justos e acordados, firmam o presente instrumento em duas vias de igual teor e forma.',
        localData: `${c.cidade || '[cidade]'}, ${c.dataDocumento ? formatarDataExtenso(c.dataDocumento) : '[data]'}.`,
        assinaturas,
      };
    },
  },
};
