(() => {
  if (window.__gustaviaInjected) return;
  window.__gustaviaInjected = true;

  const host = document.createElement('div');
  host.id = 'gustavia-host';
  host.style.all = 'initial';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .gv-panel {
      position: fixed; right: 0; top: 0; width: 340px; max-height: 88vh;
      background: #1e1e2e; color: #cdd6f4; font-family: 'Segoe UI', system-ui, sans-serif;
      border-radius: 16px 0 0 16px; overflow: hidden; box-shadow: -6px 8px 32px rgba(0,0,0,0.55);
      z-index: 2147483647; display: none; flex-direction: column;
      border: 1px solid #313244; border-right: none;
    }
    .gv-panel.open { display: flex; }
    .gv-header {
      background: #181825; padding: 9px 12px; border-bottom: 1px solid #313244;
      display: flex; justify-content: space-between; align-items: center;
      cursor: move; user-select: none; flex-shrink: 0;
    }
    .gv-header-left { display: flex; align-items: center; gap: 7px; }
    .gv-header h1 { font-size: 14px; margin: 0; color: #cba6f7; white-space: nowrap; }
    .gv-timer { font-size: 11px; font-weight: 700; color: #f38ba8; font-variant-numeric: tabular-nums; display: none; }
    .gv-timer.active { display: inline; }
    .gv-header-actions { display: flex; gap: 4px; align-items: center; }
    .gv-iconbtn { background: transparent; border: none; cursor: pointer; font-size: 13px; color: #a6adc8; padding: 2px 4px; line-height: 1; border-radius: 4px; }
    .gv-iconbtn:hover { color: #cdd6f4; background: #313244; }
    .gv-status { font-size: 10px; padding: 2px 7px; border-radius: 10px; background: #313244; color: #a6adc8; font-weight: 600; white-space: nowrap; }
    .gv-status.recording { background: #3d1a1a; color: #f38ba8; }
    .gv-status.ok { background: #1a2e1a; color: #a6e3a1; }

    /* Tabs */
    .gv-tabs { display: flex; border-bottom: 1px solid #313244; background: #181825; flex-shrink: 0; }
    .gv-tab { flex: 1; padding: 7px; font-size: 11px; font-weight: 600; border: none; background: transparent; color: #585b70; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.15s; }
    .gv-tab.active { color: #cba6f7; border-bottom-color: #cba6f7; }
    .gv-tab:hover:not(.active) { color: #a6adc8; }

    /* Tab content */
    .gv-tabcontent { display: none; flex-direction: column; overflow: hidden; flex: 1; min-height: 0; }
    .gv-tabcontent.active { display: flex; }

    /* Recording tab */
    .gv-controls { padding: 8px 12px 6px; display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
    .gv-langsel { background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 6px; padding: 5px 7px; font-size: 11px; cursor: pointer; }
    .gv-langsel:focus { outline: 1px solid #cba6f7; }
    .gv-btn { flex: 1; padding: 7px; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; transition: 0.15s; }
    .gv-btn-start { background: #d13438; color: #fff; }
    .gv-btn-start:hover:not(:disabled) { background: #b02020; }
    .gv-btn-start:disabled { opacity: 0.35; cursor: not-allowed; }
    .gv-btn-stop { background: #f38ba8; color: #1e1e2e; }
    .gv-btn-stop:hover { background: #eb6c86; }

    .gv-content { padding: 0 12px 10px; overflow-y: auto; flex: 1; min-height: 0; }
    .gv-content::-webkit-scrollbar { width: 5px; }
    .gv-content::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
    .gv-textarea { width: 100%; height: 80px; margin-bottom: 6px; border: 1px solid #313244; border-radius: 6px; padding: 7px 8px; font-family: inherit; font-size: 11px; resize: vertical; background: #181825; color: #cdd6f4; }
    .gv-textarea::placeholder { color: #585b70; }
    .gv-h3 { font-size: 11px; margin: 7px 0 4px; color: #a6adc8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .gv-result { background: #181825; border: 1px solid #313244; border-radius: 6px; padding: 8px; min-height: 50px; max-height: 150px; font-size: 12px; line-height: 1.5; overflow-y: auto; white-space: pre-wrap; color: #cdd6f4; }
    .gv-result::-webkit-scrollbar { width: 5px; }
    .gv-result::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }

    /* Partial summary */
    .gv-partial-wrap { margin-top: 8px; display: none; }
    .gv-partial-wrap.show { display: block; }
    .gv-partial-toggle { width: 100%; text-align: left; background: #181825; border: 1px solid #313244; border-radius: 6px 6px 0 0; padding: 5px 8px; font-size: 11px; color: #89dceb; cursor: pointer; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
    .gv-partial-toggle:hover { background: #1e1e3e; }
    .gv-partial-body { background: #12121c; border: 1px solid #313244; border-top: none; border-radius: 0 0 6px 6px; padding: 7px 8px; font-size: 11px; line-height: 1.5; white-space: pre-wrap; color: #cdd6f4; max-height: 100px; overflow-y: auto; display: none; }
    .gv-partial-body.open { display: block; }

    /* Action row */
    .gv-actions { display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap; }
    .gv-action-btn { flex: 1; min-width: 60px; padding: 6px 4px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; transition: 0.15s; display: none; }
    .gv-action-btn.show { display: block; }
    .gv-btn-docx { background: #313244; color: #cdd6f4; }
    .gv-btn-docx:hover { background: #45475a; }
    .gv-btn-md { background: #313244; color: #cdd6f4; }
    .gv-btn-md:hover { background: #45475a; }
    .gv-btn-copy { background: #313244; color: #89b4fa; }
    .gv-btn-copy:hover { background: #45475a; }
    .gv-btn-drive { background: #313244; color: #a6e3a1; }
    .gv-btn-drive:hover { background: #45475a; }

    /* History tab */
    .gv-history { padding: 10px 12px; overflow-y: auto; flex: 1; min-height: 0; }
    .gv-history::-webkit-scrollbar { width: 5px; }
    .gv-history::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
    .gv-hist-empty { color: #585b70; font-size: 12px; text-align: center; padding: 24px 0; }
    .gv-hist-item { background: #181825; border: 1px solid #313244; border-radius: 8px; margin-bottom: 8px; padding: 9px 10px; cursor: pointer; transition: 0.15s; }
    .gv-hist-item:hover { border-color: #585b70; }
    .gv-hist-date { font-size: 10px; color: #a6adc8; margin-bottom: 3px; }
    .gv-hist-preview { font-size: 11px; color: #cdd6f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gv-hist-detail { margin-top: 7px; font-size: 11px; white-space: pre-wrap; max-height: 120px; overflow-y: auto; color: #bac2de; display: none; }
    .gv-hist-detail.open { display: block; }

    /* Settings overlay */
    .gv-settings-overlay {
      position: absolute; inset: 0; background: #1e1e2e; z-index: 10; display: none;
      flex-direction: column; padding: 14px 14px 12px;
    }
    .gv-settings-overlay.open { display: flex; }
    .gv-settings-title { font-size: 14px; font-weight: 700; color: #cba6f7; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .gv-settings-label { font-size: 11px; color: #a6adc8; margin-bottom: 4px; font-weight: 600; }
    .gv-settings-textarea { width: 100%; height: 110px; border: 1px solid #313244; border-radius: 6px; padding: 7px 8px; font-family: inherit; font-size: 11px; resize: none; background: #181825; color: #cdd6f4; margin-bottom: 12px; }
    .gv-settings-textarea:focus { outline: 1px solid #cba6f7; }
    .gv-settings-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .gv-toggle-label { font-size: 12px; color: #cdd6f4; }
    .gv-toggle { position: relative; width: 36px; height: 20px; }
    .gv-toggle input { opacity: 0; width: 0; height: 0; }
    .gv-toggle-slider { position: absolute; inset: 0; background: #313244; border-radius: 20px; cursor: pointer; transition: 0.2s; }
    .gv-toggle-slider:before { content: ''; position: absolute; width: 14px; height: 14px; left: 3px; top: 3px; background: #a6adc8; border-radius: 50%; transition: 0.2s; }
    .gv-toggle input:checked + .gv-toggle-slider { background: #cba6f7; }
    .gv-toggle input:checked + .gv-toggle-slider:before { transform: translateX(16px); background: #1e1e2e; }
    .gv-btn-save { background: #cba6f7; color: #1e1e2e; border: none; border-radius: 6px; padding: 8px; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; margin-top: auto; }
    .gv-btn-save:hover { background: #b48ee0; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'gv-panel';
  panel.innerHTML = `
    <div class="gv-header" id="gv-drag">
      <div class="gv-header-left">
        <h1>✨ GustavIA</h1>
        <span class="gv-timer" id="gv-timer">00:00</span>
      </div>
      <div class="gv-header-actions">
        <span class="gv-status" id="gv-status">Inactivo</span>
        <button class="gv-iconbtn" id="gv-settings-btn" title="Ajustes">⚙️</button>
        <button class="gv-iconbtn" id="gv-close" title="Cerrar">✕</button>
      </div>
    </div>

    <div class="gv-tabs">
      <button class="gv-tab active" data-tab="rec">🎙️ Grabación</button>
      <button class="gv-tab" data-tab="hist">📋 Historial</button>
    </div>

    <!-- Tab: Grabación -->
    <div class="gv-tabcontent active" id="tab-rec">
      <div class="gv-controls">
        <select class="gv-langsel" id="gv-lang" title="Idioma">
          <option value="es">🇪🇸 ES</option>
          <option value="en">🇺🇸 EN</option>
          <option value="auto">🌐 Auto</option>
        </select>
        <button class="gv-btn gv-btn-stop" id="gv-stop" style="display:none">⏹ Detener</button>
        <button class="gv-btn gv-btn-start" id="gv-start">⏺ Iniciar Grabación</button>
      </div>
      <div class="gv-content">
        <div class="gv-h3">Transcripción en vivo</div>
        <textarea class="gv-textarea" id="gv-transcript" placeholder="La transcripción aparecerá aquí..." readonly></textarea>

        <div class="gv-partial-wrap" id="gv-partial-wrap">
          <button class="gv-partial-toggle" id="gv-partial-toggle">⚡ Resumen parcial <span id="gv-partial-arrow">▶</span></button>
          <div class="gv-partial-body" id="gv-partial-body"></div>
        </div>

        <div class="gv-h3" style="margin-top:8px">Resumen IA</div>
        <div class="gv-result" id="gv-result">Esperando datos de la reunión...</div>

        <div class="gv-actions">
          <button class="gv-action-btn gv-btn-docx" id="gv-export">📄 .docx</button>
          <button class="gv-action-btn gv-btn-md" id="gv-export-md">📝 .md</button>
          <button class="gv-action-btn gv-btn-copy" id="gv-copy">📋 Copiar</button>
          <button class="gv-action-btn gv-btn-drive" id="gv-drive">☁️ Drive</button>
        </div>
      </div>
    </div>

    <!-- Tab: Historial -->
    <div class="gv-tabcontent" id="tab-hist">
      <div class="gv-history" id="gv-history-list">
        <div class="gv-hist-empty">Sin sesiones guardadas</div>
      </div>
    </div>

    <!-- Settings overlay -->
    <div class="gv-settings-overlay" id="gv-settings-overlay">
      <div class="gv-settings-title">
        ⚙️ Ajustes
        <button class="gv-iconbtn" id="gv-settings-close">✕</button>
      </div>
      <div class="gv-settings-label">Prompt personalizado para el resumen IA:</div>
      <textarea class="gv-settings-textarea" id="gv-custom-prompt" placeholder="Eres GustavIA, un asistente experto. Genera un resumen de la reunión con: Resumen Ejecutivo, Decisiones, Tareas y Preguntas Abiertas. Usa Markdown."></textarea>
      <div class="gv-settings-row">
        <span class="gv-toggle-label">🔒 Modo privacidad (anonimizar nombres)</span>
        <label class="gv-toggle">
          <input type="checkbox" id="gv-privacy-mode">
          <span class="gv-toggle-slider"></span>
        </label>
      </div>
      <button class="gv-btn-save" id="gv-settings-save">💾 Guardar</button>
    </div>
  `;
  shadow.appendChild(panel);

  const $ = (id) => shadow.getElementById(id);

  const statusEl = $('gv-status');
  const timerEl = $('gv-timer');
  const transcriptEl = $('gv-transcript');
  const resultEl = $('gv-result');
  const stopBtn = $('gv-stop');
  const startBtn = $('gv-start');
  const exportBtn = $('gv-export');
  const exportMdBtn = $('gv-export-md');
  const copyBtn = $('gv-copy');
  const driveBtn = $('gv-drive');
  const closeBtn = $('gv-close');
  const dragHandle = $('gv-drag');
  const langSel = $('gv-lang');
  const settingsBtn = $('gv-settings-btn');
  const settingsOverlay = $('gv-settings-overlay');
  const settingsClose = $('gv-settings-close');
  const settingsSave = $('gv-settings-save');
  const customPromptEl = $('gv-custom-prompt');
  const privacyModeEl = $('gv-privacy-mode');
  const partialWrap = $('gv-partial-wrap');
  const partialToggle = $('gv-partial-toggle');
  const partialBody = $('gv-partial-body');
  const partialArrow = $('gv-partial-arrow');
  const historyList = $('gv-history-list');

  let currentTranscript = '';
  let currentSummary = '';
  let currentStatus = 'Inactivo';
  let hasDragged = false;
  let timerInterval = null;
  let timerSeconds = 0;

  // ---- Timer ----
  function startTimer() {
    timerSeconds = 0;
    timerEl.className = 'gv-timer active';
    timerEl.textContent = '00:00';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerEl.className = 'gv-timer';
  }

  // ---- Settings ----
  function loadSettings() {
    chrome.storage.local.get('gustavia_settings', (d) => {
      const s = (d && d.gustavia_settings) || {};
      if (s.language) langSel.value = s.language;
      if (s.customPrompt) customPromptEl.value = s.customPrompt;
      privacyModeEl.checked = !!s.privacyMode;
    });
  }
  function saveSettings() {
    const settings = {
      language: langSel.value,
      customPrompt: customPromptEl.value.trim(),
      privacyMode: privacyModeEl.checked
    };
    chrome.storage.local.set({ gustavia_settings: settings });
  }
  settingsBtn.onclick = () => { loadSettings(); settingsOverlay.classList.add('open'); };
  settingsClose.onclick = () => settingsOverlay.classList.remove('open');
  settingsSave.onclick = () => { saveSettings(); settingsOverlay.classList.remove('open'); };
  langSel.onchange = () => { chrome.storage.local.get('gustavia_settings', (d) => { const s = (d && d.gustavia_settings) || {}; s.language = langSel.value; chrome.storage.local.set({ gustavia_settings: s }); }); };

  // ---- Tabs ----
  shadow.querySelectorAll('.gv-tab').forEach(tab => {
    tab.onclick = () => {
      shadow.querySelectorAll('.gv-tab').forEach(t => t.classList.remove('active'));
      shadow.querySelectorAll('.gv-tabcontent').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'hist') renderHistory();
    };
  });

  // ---- History ----
  function saveToHistory(summary, transcript) {
    chrome.storage.local.get('gustavia_history', (d) => {
      const history = (d && d.gustavia_history) || [];
      history.unshift({
        date: new Date().toLocaleString('es-CO'),
        summary: summary || '',
        transcript: transcript || ''
      });
      if (history.length > 10) history.length = 10;
      chrome.storage.local.set({ gustavia_history: history });
    });
  }
  function renderHistory() {
    chrome.storage.local.get('gustavia_history', (d) => {
      const history = (d && d.gustavia_history) || [];
      if (!history.length) {
        historyList.innerHTML = '<div class="gv-hist-empty">Sin sesiones guardadas</div>';
        return;
      }
      historyList.innerHTML = '';
      history.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'gv-hist-item';
        const preview = (item.summary || '').slice(0, 80) + ((item.summary || '').length > 80 ? '…' : '');
        div.innerHTML = `
          <div class="gv-hist-date">📅 ${item.date}</div>
          <div class="gv-hist-preview">${preview || 'Sin resumen'}</div>
          <div class="gv-hist-detail" id="hist-detail-${i}">${item.summary}\n\n---\n\n${item.transcript}</div>
        `;
        div.onclick = () => {
          const detail = shadow.getElementById(`hist-detail-${i}`);
          if (detail) detail.classList.toggle('open');
        };
        historyList.appendChild(div);
      });
    });
  }

  // ---- Partial summary ----
  partialToggle.onclick = () => {
    partialBody.classList.toggle('open');
    partialArrow.textContent = partialBody.classList.contains('open') ? '▼' : '▶';
  };

  // ---- State helpers ----
  function setStatus(text, cls) {
    currentStatus = text;
    statusEl.textContent = text;
    statusEl.className = 'gv-status ' + (cls || '');
  }

  function showActionBtns(show) {
    [exportBtn, exportMdBtn, copyBtn, driveBtn].forEach(b => {
      b.classList.toggle('show', show);
    });
  }

  function setRecordingUI(isRec) {
    startBtn.disabled = isRec;
    stopBtn.style.display = isRec ? 'block' : 'none';
    startBtn.style.display = isRec ? 'none' : 'block';
  }

  function syncWithBackground() {
    try {
      chrome.runtime.sendMessage({ type: 'get-recording-state' }, (resp) => {
        if (chrome.runtime.lastError || !resp) return;
        if (resp.isRecording) {
          setStatus('🔴 Grabando en silencio', 'recording');
          setRecordingUI(true);
        }
      });
    } catch (e) {}
  }

  // ---- Messages from background ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle-panel') {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) { syncWithBackground(); loadSettings(); }
      return;
    }
    if (msg.type === 'capture-started') {
      setStatus('🔴 Grabando en silencio', 'recording');
      setRecordingUI(true);
      startTimer();
      partialWrap.classList.remove('show');
      panel.classList.add('open');
      return;
    }
    if (msg.type === 'transcript-update') {
      currentTranscript = msg.text || '';
      transcriptEl.value = currentTranscript;
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
      return;
    }
    if (msg.type === 'partial-summary-update') {
      partialWrap.classList.add('show');
      partialBody.textContent = msg.text || '';
      return;
    }
    if (msg.type === 'generating-summary') {
      setStatus('⏳ Procesando IA...', '');
      stopTimer();
      setRecordingUI(false);
      stopBtn.style.display = 'none';
      startBtn.style.display = 'block';
      return;
    }
    if (msg.type === 'capture-stopped') {
      setStatus('✅ Finalizado', 'ok');
      stopTimer();
      setRecordingUI(false);
      currentSummary = msg.summary || '';
      if (msg.transcript) currentTranscript = msg.transcript;
      transcriptEl.value = currentTranscript;
      resultEl.textContent = currentSummary;
      showActionBtns(true);
      panel.classList.add('open');
      saveToHistory(currentSummary, currentTranscript);
      return;
    }
    if (msg.type === 'capture-error') {
      setStatus('❌ Error', '');
      stopTimer();
      setRecordingUI(false);
      resultEl.textContent = 'Error: ' + (msg.error || 'Error desconocido');
      panel.classList.add('open');
      return;
    }
  });

  // ---- Recording controls ----
  startBtn.onclick = () => {
    currentTranscript = '';
    currentSummary = '';
    transcriptEl.value = '';
    resultEl.textContent = 'Esperando datos de la reunión...';
    showActionBtns(false);
    partialWrap.classList.remove('show');
    partialBody.textContent = '';
    setStatus('Iniciando...', '');
    chrome.storage.local.get('gustavia_settings', (d) => {
      const s = (d && d.gustavia_settings) || {};
      chrome.runtime.sendMessage({ type: 'start-capture-request', language: s.language || langSel.value || 'es' });
    });
  };

  stopBtn.onclick = () => {
    setStatus('⏳ Procesando IA...', '');
    stopTimer();
    setRecordingUI(false);
    chrome.runtime.sendMessage({ type: 'stop-capture' });
    setTimeout(() => {
      if (currentStatus === '⏳ Procesando IA...') {
        setStatus('❌ Timeout', '');
        resultEl.textContent = 'Error: La captura no respondió. Recarga la página e intenta de nuevo.';
      }
    }, 20000);
  };

  closeBtn.onclick = () => panel.classList.remove('open');

  // ---- .docx export (pure JS) ----
  function crc32(data) {
    if (!crc32._t) {
      crc32._t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        crc32._t[i] = c;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = crc32._t[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const cd = [];
    let off = 0;
    for (const { name, data } of files) {
      const nb = enc.encode(name);
      const db = enc.encode(data);
      const crc = crc32(db);
      const lh = new Uint8Array(30 + nb.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
      dv.setUint32(14, crc, true); dv.setUint32(18, db.length, true);
      dv.setUint32(22, db.length, true); dv.setUint16(26, nb.length, true);
      lh.set(nb, 30);
      parts.push(lh, db);
      const ce = new Uint8Array(46 + nb.length);
      const cv = new DataView(ce.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, db.length, true); cv.setUint32(24, db.length, true);
      cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true);
      ce.set(nb, 46);
      cd.push(ce);
      off += lh.length + db.length;
    }
    const cdSize = cd.reduce((s, e) => s + e.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true);
    ev.setUint32(16, off, true);
    return new Blob([...parts, ...cd, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function buildDocx(title, summary, transcript) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paras = text => (text || '').split('\n').map(l =>
      `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`
    ).join('');
    const heading = (text, size) =>
      `<w:p><w:r><w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`;

    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${heading(title, 36)}
<w:p/>
${heading('Resumen IA', 28)}
${paras(summary)}
<w:p/>
${heading('Transcripción', 28)}
${paras(transcript)}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
</w:body></w:document>`;

    return buildZip([
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
      { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>` },
      { name: 'word/document.xml', data: doc },
    ]);
  }

  function dateStamp() { return new Date().toLocaleDateString('es-CO').replace(/\//g, '-'); }

  exportBtn.onclick = () => {
    const date = dateStamp();
    const blob = buildDocx(`Notas GustavIA — ${date}`, currentSummary, currentTranscript);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GustavIA_${date}.docx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  exportMdBtn.onclick = () => {
    const date = dateStamp();
    const content = `# Notas de Reunión — GustavIA\nFecha: ${date}\n\n## Resumen IA\n${currentSummary}\n\n---\n\n## Transcripción\n${currentTranscript}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GustavIA_${date}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  copyBtn.onclick = () => {
    const text = currentSummary || currentTranscript;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = '✅ Copiado';
      setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 2000);
    }).catch(() => {
      copyBtn.textContent = '❌ Error';
      setTimeout(() => { copyBtn.textContent = '📋 Copiar'; }, 2000);
    });
  };

  driveBtn.onclick = () => {
    if (!currentSummary && !currentTranscript) return;
    driveBtn.textContent = '⏳ Subiendo...';
    driveBtn.disabled = true;
    chrome.runtime.sendMessage({
      type: 'drive-upload',
      summary: currentSummary,
      transcript: currentTranscript,
      date: new Date().toLocaleString('es-CO')
    }, (resp) => {
      driveBtn.disabled = false;
      if (resp && resp.success) {
        driveBtn.textContent = '✅ Drive';
        setTimeout(() => { driveBtn.textContent = '☁️ Drive'; }, 3000);
      } else {
        driveBtn.textContent = '❌ Drive';
        resultEl.textContent = 'Error Drive: ' + ((resp && resp.error) || 'Error desconocido');
        setTimeout(() => { driveBtn.textContent = '☁️ Drive'; }, 3000);
      }
    });
  };

  // ---- Drag ----
  let dragging = false, offsetX = 0, offsetY = 0;
  dragHandle.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    panel.style.left = (e.clientX - offsetX) + 'px';
    panel.style.right = 'auto';
    panel.style.top = (e.clientY - offsetY) + 'px';
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; hasDragged = true; } });

  // ---- Init ----
  loadSettings();
  syncWithBackground();
})();
