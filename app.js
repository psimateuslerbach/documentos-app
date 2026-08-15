// ============================================================
// Estado em memória — só existe depois de desbloquear o cofre.
// Nunca é escrito no disco sem passar por salvarCofre() (criptografado).
// ============================================================
let cryptoKey = null;
let appData = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function dadosPadrao() {
  return {
    perfil: { nome: 'Mateus Brandão Lerbach', cpf: '032.732.171-70', crp: '01/26219' },
    pacientes: [],
    documentos: [],
    prontuario: [],
  };
}

function pacienteDefault() {
  return {
    id: uid(),
    nome: '',
    isMenor: false,
    dataNascimento: '',
    dataInicio: '',
    cpf: '',
    responsaveis: [{ nome: '', cpf: '', parentesco: '' }],
    valorSessao: '',
    modalidade: 'presencial',
    frequencia: 'semanal',
    duracaoSessao: 'até 50 minutos',
    cidade: 'Brasília',
  };
}

function persistir() {
  salvarCofre(cryptoKey, appData).then(ok => {
    if (!ok) alert('Não foi possível salvar agora. Evite fechar a aba até conseguir salvar de novo (pode ser espaço de armazenamento do navegador).');
  });
}

// ============================================================
// Helpers de DOM (evita repetir innerHTML solto por todo lado
// e evita interpolar texto do usuário como HTML)
// ============================================================
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function mkLabel(text) { return el('label', { text }); }

function mkTextInput(value, onInput, opts = {}) {
  const input = el('input', { type: opts.type || 'text' });
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.step) input.step = opts.step;
  if (opts.min !== undefined) input.min = opts.min;
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function mkTextarea(value, onInput, placeholder) {
  const ta = el('textarea');
  if (placeholder) ta.placeholder = placeholder;
  ta.value = value ?? '';
  ta.addEventListener('input', () => onInput(ta.value));
  return ta;
}

function mkCheckbox(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return input;
}

function mkSelect(options, value, onChange) {
  const select = el('select');
  options.forEach(([val, label]) => {
    const opt = el('option', { value: val, text: label });
    if (val === value) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function field(labelText, inputEl) {
  const frag = document.createDocumentFragment();
  frag.appendChild(mkLabel(labelText));
  frag.appendChild(inputEl);
  return frag;
}

function fmtDataBR(iso) { return formatarDataBR(iso); }

// ============================================================
// Cofre — criar / desbloquear / bloquear / resetar
// ============================================================
function initLockScreen() {
  const semCripto = !cryptoDisponivel();
  document.getElementById('lock-no-crypto').hidden = !semCripto;
  if (semCripto) {
    document.getElementById('lock-create').hidden = true;
    document.getElementById('lock-unlock').hidden = true;
    return;
  }
  const existe = vaultExists();
  document.getElementById('lock-create').hidden = existe;
  document.getElementById('lock-unlock').hidden = !existe;
}

function mostrarApp() {
  document.getElementById('lock-screen').hidden = true;
  document.getElementById('app-shell').hidden = false;
  renderTudo();
}

function wireLockScreen() {
  document.getElementById('btn-create-vault').addEventListener('click', async () => {
    const p1 = document.getElementById('new-pass').value;
    const p2 = document.getElementById('new-pass-confirm').value;
    const err = document.getElementById('create-error');
    const btn = document.getElementById('btn-create-vault');
    err.textContent = '';
    if (p1.length < 8) { err.textContent = 'Use pelo menos 8 caracteres.'; return; }
    if (p1 !== p2) { err.textContent = 'As senhas não são iguais.'; return; }
    if (!cryptoDisponivel()) { err.textContent = 'Este navegador não tem suporte a criptografia (Web Crypto). Tente abrir o arquivo em outro navegador atualizado.'; return; }
    btn.disabled = true;
    btn.textContent = 'Criando...';
    try {
      cryptoKey = await criarCofre(p1, dadosPadrao());
      appData = dadosPadrao();
      mostrarApp();
    } catch (e) {
      console.error('Falha ao criar cofre:', e);
      if (e && e.message === 'STORAGE_WRITE_FAILED') {
        err.textContent = 'Não foi possível salvar no navegador. Verifique se o armazenamento local está bloqueado (modo privado, configuração de privacidade) e tente de novo.';
      } else {
        err.textContent = 'Algo deu errado ao criar a senha (' + (e && e.message ? e.message : 'erro desconhecido') + '). Tente de novo ou abra em outro navegador.';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Criar senha e começar';
    }
  });

  document.getElementById('btn-unlock').addEventListener('click', async () => {
    const p = document.getElementById('unlock-pass').value;
    const err = document.getElementById('unlock-error');
    const btn = document.getElementById('btn-unlock');
    err.textContent = '';
    if (!cryptoDisponivel()) { err.textContent = 'Este navegador não tem suporte a criptografia (Web Crypto). Tente abrir o arquivo em outro navegador atualizado.'; return; }
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    try {
      const r = await desbloquearCofre(p);
      cryptoKey = r.key;
      appData = r.dados;
      mostrarApp();
    } catch (e) {
      console.error('Falha ao desbloquear:', e);
      err.textContent = 'Senha incorreta.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  document.getElementById('unlock-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-unlock').click();
  });
  document.getElementById('new-pass-confirm').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-create-vault').click();
  });

  document.getElementById('btn-show-reset').addEventListener('click', () => {
    document.getElementById('reset-confirm').hidden = false;
  });
  document.getElementById('btn-cancel-reset').addEventListener('click', () => {
    document.getElementById('reset-confirm').hidden = true;
    document.getElementById('reset-confirm-input').value = '';
  });
  document.getElementById('btn-confirm-reset').addEventListener('click', () => {
    if (document.getElementById('reset-confirm-input').value.trim() !== 'APAGAR TUDO') {
      alert('Digite exatamente "APAGAR TUDO" pra confirmar.');
      return;
    }
    resetarCofre();
    location.reload();
  });

  document.getElementById('btn-lock').addEventListener('click', () => {
    cryptoKey = null;
    appData = null;
    document.getElementById('app-shell').hidden = true;
    document.getElementById('lock-screen').hidden = false;
    document.getElementById('unlock-pass').value = '';
    document.getElementById('unlock-error').textContent = '';
    initLockScreen();
  });

  // Exportar/importar o cofre (arquivo .json) — sincronização manual entre
  // aparelhos, sem servidor: o Mac e o celular não se falam automaticamente,
  // o Mateus decidiu por esse caminho em vez de nuvem (15/08/2026).
  document.getElementById('btn-export').addEventListener('click', async () => {
    const btn = document.getElementById('btn-export');
    btn.disabled = true;
    // Recriptografa o estado atual na hora, em vez de confiar que o último
    // persistir() (assíncrono) já terminou de escrever — sem isso, exportar
    // logo após editar algo podia baixar um cofre desatualizado.
    const ok = await salvarCofre(cryptoKey, appData);
    btn.disabled = false;
    if (!ok) { alert('Não foi possível preparar o cofre pra exportar.'); return; }
    const rec = readVaultRecord();
    const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentos-app-cofre-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-show-import').addEventListener('click', () => {
    document.getElementById('import-block').hidden = false;
    document.getElementById('import-warning').hidden = !vaultExists();
  });
  document.getElementById('btn-cancel-import').addEventListener('click', () => {
    document.getElementById('import-block').hidden = true;
    document.getElementById('import-file').value = '';
    document.getElementById('import-error').textContent = '';
  });
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const err = document.getElementById('import-error');
    err.textContent = '';
    if (!file) return;
    if (vaultExists() && !confirm('Já existe um cofre neste aparelho. Importar vai SUBSTITUIR os dados daqui permanentemente. Continuar?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rec = JSON.parse(ev.target.result);
        if (!rec.salt || !rec.iv || !rec.ciphertext) throw new Error('o arquivo não parece ser um cofre válido');
        const ok = writeVaultRecord(rec);
        if (!ok) throw new Error('não foi possível salvar (armazenamento bloqueado neste navegador)');
        alert('Cofre importado. Use a mesma senha do outro aparelho pra entrar.');
        location.reload();
      } catch (err2) {
        err.textContent = 'Não foi possível importar: ' + err2.message;
      }
    };
    reader.onerror = () => { err.textContent = 'Não foi possível ler o arquivo.'; };
    reader.readAsText(file);
  });
}

// ============================================================
// Abas
// ============================================================
function wireTabs() {
  document.getElementById('tab-switch').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    document.querySelectorAll('#tab-switch button').forEach(b => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('on'));
    document.getElementById('panel-' + btn.dataset.tab).classList.add('on');
  });
}

function renderTudo() {
  renderPacientesTab();
  renderGerarTab();
  renderProntuarioTab();
  renderDocumentosTab();
}

// ============================================================
// Aba Pacientes
// ============================================================
function pacienteById(id) { return appData.pacientes.find(p => p.id === id); }

function renderPacientesTab() {
  const panel = document.getElementById('panel-pacientes');
  panel.innerHTML = '';
  panel.appendChild(buildPerfilCard());

  const toolbar = el('div', { class: 'list-toolbar' }, [
    el('h2', { text: 'Pacientes' }),
    el('button', { class: 'btn btn-primary', text: '+ Novo paciente', onclick: () => renderPacienteForm(null) }),
  ]);
  panel.appendChild(toolbar);

  if (appData.pacientes.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Nenhum paciente cadastrado ainda.' }));
    return;
  }

  const list = el('div', { class: 'card-list' });
  [...appData.pacientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(pac => {
    const sub = pac.isMenor
      ? `Menor de idade${pac.responsaveis && pac.responsaveis[0] && pac.responsaveis[0].nome ? ' · resp.: ' + pac.responsaveis[0].nome : ''}`
      : (pac.cpf || 'CPF não informado');
    const card = el('div', { class: 'card', onclick: () => renderPacienteForm(pac.id) }, [
      el('div', { class: 'card-main' }, [
        el('div', { class: 'card-title' }, [pac.nome || '(sem nome)', pac.isMenor ? el('span', { class: 'badge', text: 'menor' }) : '']),
        el('div', { class: 'card-sub', text: sub }),
      ]),
      el('div', { class: 'chevron', text: '›' }),
    ]);
    list.appendChild(card);
  });
  panel.appendChild(list);
}

function buildPerfilCard() {
  const card = el('div', { class: 'form-card' });
  card.style.marginBottom = '22px';
  const fs = el('fieldset');
  fs.appendChild(el('legend', { text: 'Seus dados' }));
  fs.appendChild(field('Nome completo', mkTextInput(appData.perfil.nome, v => { appData.perfil.nome = v; persistir(); })));
  const row = el('div', { class: 'row2' });
  row.appendChild(field('CPF', mkTextInput(appData.perfil.cpf, v => { appData.perfil.cpf = v; persistir(); })));
  row.appendChild(field('CRP', mkTextInput(appData.perfil.crp, v => { appData.perfil.crp = v; persistir(); })));
  fs.appendChild(row);
  card.appendChild(fs);
  return card;
}

function renderPacienteForm(pacienteId) {
  const panel = document.getElementById('panel-pacientes');
  const editando = !!pacienteId;
  const pac = editando ? pacienteById(pacienteId) : pacienteDefault();
  panel.innerHTML = '';

  panel.appendChild(el('div', { class: 'list-toolbar' }, [
    el('h2', { text: editando ? 'Editar paciente' : 'Novo paciente' }),
    el('button', { class: 'btn btn-secondary', text: '← Voltar', onclick: () => renderPacientesTab() }),
  ]));

  const card = el('div', { class: 'form-card' });

  const fsBasico = el('fieldset');
  fsBasico.appendChild(el('legend', { text: 'Identificação' }));
  fsBasico.appendChild(field('Nome completo', mkTextInput(pac.nome, v => pac.nome = v)));
  fsBasico.appendChild(field('Data de nascimento', mkTextInput(pac.dataNascimento, v => pac.dataNascimento = v, { type: 'date' })));

  const toggleRow = el('div', { class: 'toggle-row' });
  const btnAdulto = el('button', { type: 'button', text: 'Adulto', class: pac.isMenor ? '' : 'on' });
  const btnMenor = el('button', { type: 'button', text: 'Menor de idade', class: pac.isMenor ? 'on' : '' });
  const detalhesWrap = el('div');
  function renderDetalhes() {
    detalhesWrap.innerHTML = '';
    if (pac.isMenor) {
      detalhesWrap.appendChild(field('CPF do(a) paciente — opcional', mkTextInput(pac.cpf, v => pac.cpf = v, { placeholder: '000.000.000-00' })));
      detalhesWrap.appendChild(el('label', { text: 'Responsável(is)' }));
      const respList = el('div');
      function renderResps() {
        respList.innerHTML = '';
        if (!pac.responsaveis || pac.responsaveis.length === 0) pac.responsaveis = [{ nome: '', cpf: '', parentesco: '' }];
        pac.responsaveis.forEach((r, i) => {
          const row = el('div', { class: 'sub-row' });
          row.appendChild(field('Nome completo', mkTextInput(r.nome, v => r.nome = v, { placeholder: 'Nome completo do responsável' })));
          const row2 = el('div', { class: 'row2' });
          row2.appendChild(field('CPF', mkTextInput(r.cpf, v => r.cpf = v, { placeholder: '000.000.000-00' })));
          row2.appendChild(field('Parentesco', mkTextInput(r.parentesco, v => r.parentesco = v, { placeholder: 'mãe, pai, tutor(a)...' })));
          row.appendChild(row2);
          if (pac.responsaveis.length > 1) {
            row.appendChild(el('button', { type: 'button', class: 'remove-row', text: '✕ Remover este responsável', onclick: () => { pac.responsaveis.splice(i, 1); renderResps(); } }));
          }
          respList.appendChild(row);
        });
      }
      renderResps();
      detalhesWrap.appendChild(respList);
      detalhesWrap.appendChild(el('button', { type: 'button', class: 'add-row-btn', text: '+ Adicionar outro responsável', onclick: () => { pac.responsaveis.push({ nome: '', cpf: '', parentesco: '' }); renderResps(); } }));
    } else {
      detalhesWrap.appendChild(field('CPF', mkTextInput(pac.cpf, v => pac.cpf = v, { placeholder: '000.000.000-00' })));
    }
  }
  btnAdulto.addEventListener('click', () => { pac.isMenor = false; btnAdulto.classList.add('on'); btnMenor.classList.remove('on'); renderDetalhes(); });
  btnMenor.addEventListener('click', () => { pac.isMenor = true; btnMenor.classList.add('on'); btnAdulto.classList.remove('on'); renderDetalhes(); });
  toggleRow.appendChild(btnAdulto);
  toggleRow.appendChild(btnMenor);
  fsBasico.appendChild(toggleRow);
  renderDetalhes();
  fsBasico.appendChild(detalhesWrap);
  card.appendChild(fsBasico);

  const fsCond = el('fieldset');
  fsCond.appendChild(el('legend', { text: 'Condições de atendimento (usadas como padrão ao gerar documentos)' }));
  fsCond.appendChild(field('Início da terapia', mkTextInput(pac.dataInicio, v => pac.dataInicio = v, { type: 'date' })));
  fsCond.appendChild(field('Valor por sessão (R$)', mkTextInput(pac.valorSessao, v => pac.valorSessao = v, { type: 'number', step: '0.01', min: '0' })));
  fsCond.appendChild(el('label', { text: 'Modalidade' }));
  fsCond.appendChild(mkSelect([['presencial', 'Presencial'], ['online', 'Online (telepsicologia)']], pac.modalidade, v => pac.modalidade = v));
  const row3 = el('div', { class: 'row2' });
  row3.appendChild(field('Frequência', mkTextInput(pac.frequencia, v => pac.frequencia = v)));
  row3.appendChild(field('Duração da sessão', mkTextInput(pac.duracaoSessao, v => pac.duracaoSessao = v)));
  fsCond.appendChild(row3);
  fsCond.appendChild(field('Cidade', mkTextInput(pac.cidade, v => pac.cidade = v)));
  card.appendChild(fsCond);

  const actions = el('div', { class: 'form-actions' });
  actions.appendChild(el('button', {
    class: 'btn btn-primary', text: 'Salvar paciente', onclick: () => {
      if (!pac.nome.trim()) { alert('Digite o nome do paciente.'); return; }
      if (!editando) appData.pacientes.push(pac);
      persistir();
      renderTudo();
      renderPacientesTab();
    }
  }));
  if (editando) {
    actions.appendChild(el('button', {
      class: 'btn btn-danger', text: 'Excluir paciente', onclick: () => {
        if (!confirm(`Excluir ${pac.nome}? Isso não apaga os documentos e anotações de prontuário já salvos, mas eles ficam sem paciente vinculado.`)) return;
        appData.pacientes = appData.pacientes.filter(p => p.id !== pac.id);
        persistir();
        renderTudo();
        renderPacientesTab();
      }
    }));
  }
  card.appendChild(actions);
  panel.appendChild(card);
}

// ============================================================
// Aba Gerar Documento
// ============================================================
let gerarState = { pacienteId: '', tipo: 'recibo', campos: {}, cor: 'petroleo' };

function campoValorInicial(campo, paciente) {
  const raw = campo.fonte === 'paciente' && paciente ? paciente[campo.id] : undefined;
  if (raw !== undefined && raw !== null && raw !== '') return raw;
  return typeof campo.default === 'function' ? campo.default() : campo.default;
}

function renderGerarTab() {
  const panel = document.getElementById('panel-gerar');
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'list-toolbar' }, [el('h2', { text: 'Gerar documento' })]));

  if (appData.pacientes.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Cadastre um paciente primeiro, na aba Pacientes.' }));
    return;
  }

  const layout = el('div', { class: 'gerar-layout' });
  const formCard = el('div', { class: 'form-card' });

  formCard.appendChild(el('label', { text: 'Paciente' }));
  const pacienteOptions = [['', 'Selecione...']].concat(
    [...appData.pacientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => [p.id, p.nome])
  );
  const selectPaciente = mkSelect(pacienteOptions, gerarState.pacienteId, v => { gerarState.pacienteId = v; gerarState.campos = {}; renderGerarTab(); });
  formCard.appendChild(selectPaciente);

  const paciente = pacienteById(gerarState.pacienteId);

  const tipoRow = el('div', { class: 'picker-row' });
  tipoRow.style.marginTop = '14px';
  Object.entries(TIPOS_DOCUMENTO).forEach(([tipoId, def]) => {
    const desabilitado = def.somenteMenores && (!paciente || !paciente.isMenor);
    const btn = el('button', { type: 'button', text: def.label });
    if (tipoId === gerarState.tipo) btn.classList.add('on');
    if (desabilitado) { btn.disabled = true; btn.title = 'Só disponível pra pacientes cadastrados como menores de idade.'; }
    btn.addEventListener('click', () => { gerarState.tipo = tipoId; gerarState.campos = {}; renderGerarTab(); });
    tipoRow.appendChild(btn);
  });
  formCard.appendChild(tipoRow);

  formCard.appendChild(el('label', { text: 'Cor', style: 'margin-top:14px;' }));
  const corRow = el('div', { class: 'picker-row cor-row' });
  Object.entries(CORES).forEach(([corId, def]) => {
    const btn = el('button', { type: 'button' });
    if (corId === gerarState.cor) btn.classList.add('on');
    const swatch = el('span', { class: 'swatch' });
    swatch.style.background = def.minimal ? '#ffffff' : { petroleo: '#0c4e68', azul: '#629add', preto: '#353535', areia: '#f4d2ab', verde: '#c7d37d' }[corId];
    if (def.minimal) swatch.style.border = '1px solid #ccc';
    btn.appendChild(swatch);
    btn.appendChild(document.createTextNode(def.label));
    btn.addEventListener('click', () => { gerarState.cor = corId; renderGerarTab(); });
    corRow.appendChild(btn);
  });
  formCard.appendChild(corRow);

  const camposWrap = el('div');
  camposWrap.style.marginTop = '6px';
  formCard.appendChild(camposWrap);

  const previewWrap = el('div', { class: 'preview-wrap' });
  const pageEl = el('div', { class: 'doc-page' });
  previewWrap.appendChild(pageEl);

  function atualizarPreview() {
    if (!paciente) { pageEl.innerHTML = ''; return; }
    const def = TIPOS_DOCUMENTO[gerarState.tipo];
    const conteudo = def.montar(paciente, appData.perfil, gerarState.campos);
    renderDocPage(pageEl, def.shell, conteudo, gerarState.cor);
  }

  if (paciente) {
    const def = TIPOS_DOCUMENTO[gerarState.tipo];
    def.campos.forEach(campo => {
      if (!(campo.id in gerarState.campos)) gerarState.campos[campo.id] = campoValorInicial(campo, paciente);
    });
    renderCamposDinamicos(camposWrap, def.campos, gerarState.campos, atualizarPreview);

    const actions = el('div', { class: 'form-actions' });
    actions.appendChild(el('button', {
      class: 'btn btn-primary', text: 'Salvar e abrir pra imprimir', onclick: () => {
        const conteudo = def.montar(paciente, appData.perfil, gerarState.campos);
        const doc = {
          id: uid(),
          pacienteId: paciente.id,
          pacienteNome: paciente.nome,
          tipo: gerarState.tipo,
          cor: gerarState.cor,
          criadoEm: new Date().toISOString(),
          campos: JSON.parse(JSON.stringify(gerarState.campos)),
          conteudo,
        };
        appData.documentos.push(doc);
        persistir();
        renderDocumentosTab();
        abrirModalDocumento(def.shell, conteudo, [], gerarState.cor);
      }
    }));
    formCard.appendChild(actions);
  }

  atualizarPreview();

  layout.appendChild(formCard);
  layout.appendChild(previewWrap);
  panel.appendChild(layout);
}

function renderCamposDinamicos(container, camposSpec, camposState, onChange) {
  container.innerHTML = '';
  const inputsPorId = {};

  function atualizarVisibilidade() {
    camposSpec.forEach(campo => {
      if (!campo.dependeDe) return;
      const wrap = inputsPorId[campo.id + '__wrap'];
      if (wrap) wrap.hidden = !camposState[campo.dependeDe];
    });
  }

  camposSpec.forEach(campo => {
    const wrap = el('div');
    wrap.appendChild(el('label', { text: campo.label }));

    let inputEl;
    if (campo.tipo === 'text') {
      inputEl = mkTextInput(camposState[campo.id], v => { camposState[campo.id] = v; onChange(); });
    } else if (campo.tipo === 'number') {
      inputEl = mkTextInput(camposState[campo.id], v => { camposState[campo.id] = v; onChange(); }, { type: 'number', step: '0.01', min: '0' });
    } else if (campo.tipo === 'date') {
      inputEl = mkTextInput(camposState[campo.id], v => { camposState[campo.id] = v; onChange(); }, { type: 'date' });
    } else if (campo.tipo === 'time') {
      inputEl = mkTextInput(camposState[campo.id], v => { camposState[campo.id] = v; onChange(); }, { type: 'time' });
    } else if (campo.tipo === 'textarea') {
      inputEl = mkTextarea(camposState[campo.id], v => { camposState[campo.id] = v; onChange(); });
    } else if (campo.tipo === 'checkbox') {
      wrap.innerHTML = '';
      const line = el('div', { class: 'checkline' });
      const cb = mkCheckbox(camposState[campo.id], v => { camposState[campo.id] = v; atualizarVisibilidade(); onChange(); });
      line.appendChild(cb);
      line.appendChild(el('label', { text: campo.label }));
      wrap.appendChild(line);
      inputEl = null;
    } else if (campo.tipo === 'modalidade') {
      inputEl = mkSelect([['presencial', 'Presencial'], ['online', 'Online (telepsicologia)']], camposState[campo.id], v => { camposState[campo.id] = v; onChange(); });
    } else if (campo.tipo === 'lista-data') {
      inputEl = null;
      const list = el('div');
      function renderLista() {
        list.innerHTML = '';
        if (!camposState[campo.id] || camposState[campo.id].length === 0) camposState[campo.id] = [''];
        camposState[campo.id].forEach((val, i) => {
          const row = el('div', { class: 'data-row' });
          const dateInput = el('input', { type: 'date' });
          dateInput.value = val;
          dateInput.addEventListener('input', () => { camposState[campo.id][i] = dateInput.value; onChange(); });
          row.appendChild(dateInput);
          if (camposState[campo.id].length > 1) {
            row.appendChild(el('button', { type: 'button', text: '✕', onclick: () => { camposState[campo.id].splice(i, 1); renderLista(); onChange(); } }));
          }
          list.appendChild(row);
        });
      }
      renderLista();
      wrap.appendChild(list);
      wrap.appendChild(el('button', { type: 'button', class: 'add-row-btn', text: '+ Adicionar sessão', onclick: () => { camposState[campo.id].push(''); renderLista(); onChange(); } }));
    }

    if (inputEl) wrap.appendChild(inputEl);
    if (campo.dependeDe) inputsPorId[campo.id + '__wrap'] = wrap;
    container.appendChild(wrap);
  });

  atualizarVisibilidade();
}

// ============================================================
// Renderização compartilhada da página do documento (2 "shells")
// ============================================================
// As 5 cores do estudo de marca + a versão branca minimalista (pedido do
// Mateus em 15/08/2026). "dark" decide se a logo/texto ficam brancos
// (fundo escuro) ou na variante petróleo da logo (fundo claro) — segue
// exatamente os pareamentos da página 4 do PDF da marca.
const CORES = {
  petroleo: { label: 'Petróleo', dark: true },
  azul: { label: 'Azul', dark: true },
  preto: { label: 'Preto', dark: true },
  areia: { label: 'Areia', dark: false },
  verde: { label: 'Verde', dark: false },
  branco: { label: 'Branco (minimalista)', minimal: true },
};

function buildWatermark(logoVertical) {
  const wm = el('div', { class: 'watermark' });
  wm.appendChild(el('img', { src: logoVertical, alt: '' }));
  return wm;
}

function renderDocPage(container, shell, conteudo, cor) {
  cor = cor || 'petroleo';
  const corDef = CORES[cor] || CORES.petroleo;
  const shellEfetivo = corDef.minimal ? 'minimal' : shell;
  const escura = corDef.dark !== false && !corDef.minimal;
  const logoHorizontal = escura ? 'icons/logo-horizontal-branco.png' : 'icons/logo-horizontal-petroleo.png';
  const logoVertical = escura ? 'icons/logo-branco.png' : 'icons/logo-petroleo.png';

  // "from-teal"/"from-letterhead" preserva de qual shell original o "Branco"
  // veio, porque o recibo (teal) tem formatação de texto diferente dos
  // outros 3 documentos (letterhead) — o branco precisa imitar a formatação
  // certa conforme o tipo, não uma formatação única pra tudo.
  container.className = 'doc-page shell-' + shellEfetivo + ' from-' + shell + (conteudo.subtitulo ? ' has-subtitle' : '');
  container.dataset.cor = cor;
  container.innerHTML = '';
  if (shellEfetivo === 'minimal') container.appendChild(buildWatermark(logoVertical));

  if (shellEfetivo === 'teal') {
    const logoBlock = el('div', { class: 'logo-block' });
    logoBlock.appendChild(el('img', { src: logoHorizontal, alt: 'Mateus Lerbach Psicólogo' }));
    container.appendChild(logoBlock);
    container.appendChild(el('div', { class: 'doc-title', text: conteudo.titulo }));
    const corpo = el('div', { class: 'corpo' });
    conteudo.corpo.forEach(p => corpo.appendChild(el('p', { text: p })));
    container.appendChild(corpo);
    container.appendChild(el('p', { class: 'local-data', text: conteudo.localData }));
    const sigArea = el('div', { class: 'signature-area' });
    conteudo.assinaturas.forEach(a => sigArea.appendChild(buildSigBlock(a)));
    container.appendChild(sigArea);
    return;
  }

  // letterhead (faixa colorida) ou minimal (branco, logo pequena)
  if (shellEfetivo === 'minimal') {
    const header = el('div', { class: 'header-min' });
    header.appendChild(el('img', { src: logoHorizontal, alt: 'Mateus Lerbach Psicólogo' }));
    container.appendChild(header);
  } else {
    const band = el('div', { class: 'band' });
    band.appendChild(el('img', { src: logoHorizontal, alt: 'Mateus Lerbach Psicólogo' }));
    container.appendChild(band);
  }

  const body = el('div', { class: 'doc-body' });
  body.appendChild(el('div', { class: 'doc-title', text: conteudo.titulo }));
  if (conteudo.subtitulo) body.appendChild(el('div', { class: 'doc-subtitle', text: conteudo.subtitulo }));

  if (conteudo.abertura) body.appendChild(el('p', { class: 'abertura', text: conteudo.abertura }));

  if (conteudo.corpo) {
    const corpo = el('div', { class: 'corpo' });
    conteudo.corpo.forEach(p => corpo.appendChild(el('p', { text: p })));
    body.appendChild(corpo);
  }

  if (conteudo.clausulas) {
    conteudo.clausulas.forEach(cl => {
      const clDiv = el('div', { class: 'clause' });
      clDiv.appendChild(el('p', { class: 'clause-title', text: cl.titulo }));
      clDiv.appendChild(el('p', { text: cl.texto }));
      body.appendChild(clDiv);
    });
  }

  if (conteudo.fechamento) body.appendChild(el('p', { text: conteudo.fechamento }));

  body.appendChild(el('p', { class: 'local-data', text: conteudo.localData }));

  const sigArea = el('div', { class: 'signature-area' });
  conteudo.assinaturas.forEach(a => sigArea.appendChild(buildSigBlock(a)));
  body.appendChild(sigArea);

  container.appendChild(body);
}

function buildSigBlock(assinatura) {
  const block = el('div', { class: 'sig-block' });
  block.appendChild(el('div', { class: 'line' }));
  block.appendChild(el('p', { class: 'sname', text: assinatura.nome }));
  block.appendChild(el('p', { class: 'ssub', text: assinatura.sub }));
  return block;
}

// ============================================================
// Modal de visualização / impressão
// ============================================================
function abrirModalDocumento(shell, conteudo, extraButtons = [], cor = 'petroleo') {
  const pageEl = document.getElementById('doc-page-render');
  renderDocPage(pageEl, shell, conteudo, cor);

  const toolbar = document.querySelector('.modal-toolbar');
  const antigoExtra = document.getElementById('modal-extra-actions');
  if (antigoExtra) antigoExtra.remove();
  if (extraButtons.length) {
    const extra = el('div', { id: 'modal-extra-actions', style: 'display:flex; gap:10px;' });
    extraButtons.forEach(b => extra.appendChild(b));
    toolbar.insertBefore(extra, toolbar.firstChild.nextSibling);
  }

  document.getElementById('modal-overlay').classList.add('on');
}

function wireModal() {
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.remove('on');
  });
  document.getElementById('modal-print').addEventListener('click', () => window.print());
}

// ============================================================
// Aba Prontuário
// ============================================================
let prontuarioState = { pacienteId: '' };

function renderProntuarioTab() {
  const panel = document.getElementById('panel-prontuario');
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'list-toolbar' }, [el('h2', { text: 'Prontuário' })]));

  if (appData.pacientes.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Cadastre um paciente primeiro, na aba Pacientes.' }));
    return;
  }

  panel.appendChild(el('label', { text: 'Paciente' }));
  const pacienteOptions = [['', 'Selecione...']].concat(
    [...appData.pacientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => [p.id, p.nome])
  );
  panel.appendChild(mkSelect(pacienteOptions, prontuarioState.pacienteId, v => { prontuarioState.pacienteId = v; renderProntuarioTab(); }));

  if (!prontuarioState.pacienteId) return;
  const paciente = pacienteById(prontuarioState.pacienteId);
  if (!paciente) { prontuarioState.pacienteId = ''; return; }

  const novaCard = el('div', { class: 'form-card' });
  novaCard.style.margin = '18px 0';
  const novaData = { data: new Date().toISOString().slice(0, 10), texto: '' };
  novaCard.appendChild(field('Data', mkTextInput(novaData.data, v => novaData.data = v, { type: 'date' })));
  novaCard.appendChild(field('Anotação', mkTextarea(novaData.texto, v => novaData.texto = v, 'Anotação de sessão...')));
  novaCard.appendChild(el('div', { class: 'form-actions' }, [
    el('button', {
      class: 'btn btn-primary', text: '+ Adicionar anotação', onclick: () => {
        if (!novaData.texto.trim()) { alert('Escreva alguma coisa antes de salvar.'); return; }
        appData.prontuario.push({ id: uid(), pacienteId: paciente.id, data: novaData.data, texto: novaData.texto, criadoEm: new Date().toISOString() });
        persistir();
        renderProntuarioTab();
      }
    })
  ]));
  panel.appendChild(novaCard);

  const notas = appData.prontuario.filter(n => n.pacienteId === paciente.id).sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));

  const toolbar = el('div', { class: 'list-toolbar' });
  toolbar.appendChild(el('h2', { text: `Anotações de ${paciente.nome}` }));
  if (notas.length > 0) {
    toolbar.appendChild(el('button', { class: 'btn btn-secondary', text: 'Exportar histórico completo', onclick: () => exportarHistoricoProntuario(paciente, notas) }));
  }
  panel.appendChild(toolbar);

  if (notas.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Nenhuma anotação ainda.' }));
    return;
  }

  const list = el('div', { class: 'card-list' });
  notas.forEach(nota => {
    const card = el('div', { class: 'card' });
    card.style.cursor = 'default';
    const resumo = nota.texto.length > 140 ? nota.texto.slice(0, 140) + '…' : nota.texto;
    card.appendChild(el('div', { class: 'card-main' }, [
      el('div', { class: 'card-title', text: formatarDataBR(nota.data) }),
      el('div', { class: 'card-sub', text: resumo }),
    ]));
    const acoes = el('div', { style: 'display:flex; gap:6px; flex:0 0 auto;' });
    acoes.appendChild(el('button', { class: 'btn btn-secondary btn-sm', text: 'Imprimir', onclick: () => exportarNotaUnica(paciente, nota) }));
    acoes.appendChild(el('button', { class: 'btn btn-danger btn-sm', text: 'Excluir', onclick: () => { if (!confirm('Excluir esta anotação?')) return; appData.prontuario = appData.prontuario.filter(n => n.id !== nota.id); persistir(); renderProntuarioTab(); } }));
    card.appendChild(acoes);
    list.appendChild(card);
  });
  panel.appendChild(list);
}

function exportarNotaUnica(paciente, nota) {
  const conteudo = {
    titulo: 'Prontuário Psicológico',
    subtitulo: paciente.nome,
    corpo: [`${formatarDataExtenso(nota.data)}`, nota.texto],
    localData: '',
    assinaturas: [{ nome: appData.perfil.nome, sub: `CRP: ${appData.perfil.crp}` }],
  };
  abrirModalDocumento('letterhead', conteudo);
}

function exportarHistoricoProntuario(paciente, notas) {
  const ordenadas = [...notas].sort((a, b) => a.data.localeCompare(b.data));
  const corpo = [];
  ordenadas.forEach(n => {
    corpo.push(`${formatarDataExtenso(n.data)} — ${n.texto}`);
  });
  const conteudo = {
    titulo: 'Prontuário Psicológico',
    subtitulo: paciente.nome,
    corpo,
    localData: `Documento gerado em ${formatarDataExtenso(new Date().toISOString().slice(0, 10))}.`,
    assinaturas: [{ nome: appData.perfil.nome, sub: `CRP: ${appData.perfil.crp}` }],
  };
  abrirModalDocumento('letterhead', conteudo);
}

// ============================================================
// Aba Documentos Salvos
// ============================================================
let documentosFiltro = { pacienteId: '', tipo: '' };

function renderDocumentosTab() {
  const panel = document.getElementById('panel-documentos');
  panel.innerHTML = '';
  panel.appendChild(el('div', { class: 'list-toolbar' }, [el('h2', { text: 'Documentos salvos' })]));

  if (appData.documentos.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Nenhum documento gerado ainda. Use a aba "Gerar documento".' }));
    return;
  }

  const filterRow = el('div', { class: 'filter-row' });
  const pacienteOptions = [['', 'Todos os pacientes']].concat(appData.pacientes.map(p => [p.id, p.nome]));
  filterRow.appendChild(mkSelect(pacienteOptions, documentosFiltro.pacienteId, v => { documentosFiltro.pacienteId = v; renderDocumentosTab(); }));
  const tipoOptions = [['', 'Todos os tipos']].concat(Object.entries(TIPOS_DOCUMENTO).map(([id, def]) => [id, def.label]));
  filterRow.appendChild(mkSelect(tipoOptions, documentosFiltro.tipo, v => { documentosFiltro.tipo = v; renderDocumentosTab(); }));
  panel.appendChild(filterRow);

  let docs = [...appData.documentos];
  if (documentosFiltro.pacienteId) docs = docs.filter(d => d.pacienteId === documentosFiltro.pacienteId);
  if (documentosFiltro.tipo) docs = docs.filter(d => d.tipo === documentosFiltro.tipo);
  docs.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  if (docs.length === 0) {
    panel.appendChild(el('div', { class: 'empty-state', text: 'Nenhum documento com esse filtro.' }));
    return;
  }

  const list = el('div', { class: 'card-list' });
  docs.forEach(doc => {
    const def = TIPOS_DOCUMENTO[doc.tipo];
    const criado = new Date(doc.criadoEm);
    const dataFmt = criado.toLocaleDateString('pt-BR') + ' ' + criado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const card = el('div', { class: 'card', onclick: () => abrirDocumentoSalvo(doc) }, [
      el('div', { class: 'card-main' }, [
        el('div', { class: 'card-title', text: doc.pacienteNome || '(paciente removido)' }),
        el('div', { class: 'card-sub', text: `gerado em ${dataFmt}` }),
      ]),
      el('div', { class: 'card-tipo', text: def ? def.label : doc.tipo }),
    ]);
    list.appendChild(card);
  });
  panel.appendChild(list);
}

function abrirDocumentoSalvo(doc) {
  const def = TIPOS_DOCUMENTO[doc.tipo];
  const btnExcluir = el('button', {
    class: 'btn btn-danger', text: 'Excluir documento', onclick: () => {
      if (!confirm('Excluir este documento salvo? Isso não afeta o paciente, só remove esse registro do histórico.')) return;
      appData.documentos = appData.documentos.filter(d => d.id !== doc.id);
      persistir();
      document.getElementById('modal-overlay').classList.remove('on');
      renderDocumentosTab();
    }
  });
  abrirModalDocumento(def.shell, doc.conteudo, [btnExcluir], doc.cor || 'petroleo');
}

// ============================================================
// Início
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  wireLockScreen();
  wireTabs();
  wireModal();
  initLockScreen();
});
