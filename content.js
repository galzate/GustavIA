(() => {
  if (window.__gustaviaInjected) return;
  window.__gustaviaInjected = true;

  const STORAGE_KEY = 'gustavia_panel_state';

  const host = document.createElement('div');
  host.id = 'gustavia-host';
  host.style.all = 'initial';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .gv-panel {
      position: fixed; width: 320px; max-height: 80vh;
      background: #f8f9fa; color: #323130; font-family: 'Segoe UI', sans-serif;
      border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      z-index: 2147483647; display: none; flex-direction: column;
      border: 1px solid #e1dfdd;
    }
    .gv-panel.open { display: flex; }
    .gv-panel.minimized { width: 160px; max-height: none; }
    .gv-panel.minimized .gv-body { display: none; }
    .gv-header {
      background: #fff; padding: 10px 12px; border-bottom: 1px solid #e1dfdd;
      display: flex; justify-content: space-between; align-items: center;
      cursor: move; user-select: none;
    }
    .gv-header h1 { font-size: 15px; margin: 0; color: #5b5fc7; }
    .gv-header-actions { display: flex; gap: 4px; align-items: center; }
    .gv-iconbtn { background: transparent; border: none; cursor: pointer; font-size: 14px; color: #323130; padding: 0 4px; line-height: 1; }
    .gv-status { font-size: 10px; padding: 3px 7px; border-radius: 10px; background: #e1dfdd; font-weight: 600; white-space: nowrap; }
    .gv-status.recording { background: #fed9cc; color: #d13438; }
    .gv-body { display: flex; flex-direction: column; }
    .gv-controls { padding: 8px 12px; display: flex; gap: 6px; }
    .gv-btn { flex: 1; padding: 7px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: 0.2s; }
    .gv-stop { background: #d13438; color: #fff; }
    .gv-content { padding: 0 12px 10px 12px; max-height: 50vh; overflow-y: auto; }
    .gv-textarea { width: 100%; height: 90px; margin-bottom: 6px; border: 1px solid #e1dfdd; border-radius: 6px; padding: 8px; box-sizing: border-box; font-family: inherit; font-size: 11px; resize: vertical; }
    .gv-h3 { font-size: 12px; margin: 6px 0 4px; }
    .gv-result { background: #fff; border: 1px solid #e1dfdd; border-radius: 6px; padding: 8px; min-height: 60px; max-height: 160px; font-size: 12px; line-height: 1.4; overflow-y: auto; white-space: pre-wrap; }
    .gv-export { background: transparent; color: #5b5fc7; border: 1px solid #5b5fc7; display: none; width: 100%; margin-top: 8px; padding: 7px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .gv-hint { padding: 0 12px 8px; font-size: 10px; color: #666; }
    .gv-content::-webkit-scrollbar { width: 6px; }
    .gv-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'gv-panel';
  panel.innerHTML = `
    <div class="gv-header" id="gv-drag">
      <h1>✨ GustavIA</h1>
      <div class="gv-header-actions">
        <span class="gv-status" id="gv-status">Inactivo</span>
        <button class="gv-iconbtn" id="gv-min" title="Minimizar">—</button>
        <button class="gv-iconbtn" id="gv-close" title="Cerrar">✕</button>
      </div>
    </div>
    <div class="gv-body">
      <div class="gv-controls">
        <button class="gv-btn gv-stop" id="gv-stop">⏹ Detener</button>
      </div>
      <div class="gv-hint">Clic en el icono de la extensión para iniciar/parar la captura.</div>
      <div class="gv-content">
        <textarea class="gv-textarea" id="gv-transcript" placeholder="Transcripción en vivo..." readonly></textarea>
        <div class="gv-h3">Resumen IA:</div>
        <div class="gv-result" id="gv-result">Esperando datos de la reunión...</div>
        <button class="gv-export" id="gv-export">📥 Exportar (.md)</button>
      </div>
    </div>
  `;
  shadow.appendChild(panel);

  const $ = (id) => shadow.getElementById(id);
  const statusEl = $('gv-status');
  const transcriptEl = $('gv-transcript');
  const resultEl = $('gv-result');
  const stopBtn = $('gv-stop');
  const exportBtn = $('gv-export');
  const closeBtn = $('gv-close');
  const minBtn = $('gv-min');
  const dragHandle = $('gv-drag');

  let currentTranscript = '';
  let currentSummary = '';
  let currentStatus = 'Inactivo';
  let minimized = false;

  function saveState() {
    try {
      chrome.storage.local.set({
        gustavia_panel_state: {
          transcript: currentTranscript,
          summary: currentSummary,
          status: currentStatus,
          statusClass: statusEl.className,
          minimized,
          left: panel.style.left,
          top: panel.style.top
        }
      });
    } catch (e) {}
  }
  function restoreState() {
    try {
      chrome.storage.local.get('gustavia_panel_state', (data) => {
        const s = data && data.gustavia_panel_state;
        if (!s) return;
        currentTranscript = s.transcript || '';
        currentSummary = s.summary || '';
        currentStatus = s.status || 'Inactivo';
        statusEl.innerText = currentStatus;
        statusEl.className = 'gv-status ' + (s.statusClass || '');
        transcriptEl.value = currentTranscript;
        if (currentSummary) { resultEl.innerText = currentSummary; exportBtn.style.display = 'block'; }
        if (s.minimized) { panel.classList.add('minimized'); minimized = true; minBtn.textContent = '+'; }
        if (s.left) { panel.style.left = s.left; panel.style.right = 'auto'; }
        if (s.top) { panel.style.top = s.top; }
        if (currentStatus === '🔴 Grabando en silencio') { stopBtn.style.display = 'block'; }
        else { stopBtn.style.display = 'none'; }
      });
    } catch (e) {}
  }

  function setStatus(text, cls) {
    currentStatus = text;
    statusEl.innerText = text;
    statusEl.className = 'gv-status ' + (cls || '');
    saveState();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'capture-started') {
      setStatus('🔴 Grabando en silencio', 'recording');
      stopBtn.style.display = 'block';
      panel.classList.add('open');
      saveState();
    } else if (msg.type === 'transcript-update') {
      currentTranscript = msg.text || '';
      transcriptEl.value = currentTranscript;
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
      saveState();
    } else if (msg.type === 'generating-summary') {
      setStatus('⏳ Procesando IA...', '');
      stopBtn.style.display = 'none';
      saveState();
    } else if (msg.type === 'capture-stopped') {
      setStatus('✅ Finalizado', '');
      stopBtn.style.display = 'none';
      currentSummary = msg.summary || '';
      if (msg.transcript) currentTranscript = msg.transcript;
      transcriptEl.value = currentTranscript;
      resultEl.innerText = currentSummary;
      exportBtn.style.display = 'block';
      panel.classList.add('open');
      saveState();
    } else if (msg.type === 'capture-error') {
      setStatus('❌ Error', '');
      stopBtn.style.display = 'none';
      resultEl.innerText = 'Error: ' + msg.error;
      panel.classList.add('open');
      saveState();
    } else if (msg.type === 'toggle-panel') {
      panel.classList.toggle('open');
    }
  });

  stopBtn.onclick = () => {
    stopBtn.style.display = 'none';
    setStatus('⏳ Procesando IA...', '');
    chrome.runtime.sendMessage({ type: 'stop-capture' });
    // Si no hay respuesta en 15s, mostrar error
    setTimeout(() => {
      if (currentStatus === '⏳ Procesando IA...') {
        setStatus('❌ Error', '');
        resultEl.innerText = 'Error: La captura no respondió. Recarga la página e intenta de nuevo.';
        saveState();
      }
    }, 15000);
  };

  exportBtn.onclick = () => {
    const date = new Date().toLocaleDateString().replace(/\//g, '-');
    const content = `# Notas de Reunión - GustavIA\nFecha: ${date}\n\n## Resumen IA\n${currentSummary}\n\n---\n\n## Transcripción\n${currentTranscript}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GustavIA_${date}.md`; a.click();
  };

  closeBtn.onclick = () => { panel.classList.remove('open'); };

  minBtn.onclick = () => {
    minimized = !minimized;
    panel.classList.toggle('minimized', minimized);
    minBtn.textContent = minimized ? '+' : '—';
    saveState();
  };

  let dragging = false, offsetX = 0, offsetY = 0;
  dragHandle.addEventListener('mousedown', (e) => {
    if (minimized) return;
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
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; saveState(); }
  });

  restoreState();
})();
