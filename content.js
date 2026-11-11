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
      position: fixed; right: 0; top: 0; width: 320px; max-height: 80vh;
      background: #1e1e2e; color: #cdd6f4; font-family: 'Segoe UI', sans-serif;
      border-radius: 16px 0 0 16px; overflow: hidden; box-shadow: -6px 8px 32px rgba(0,0,0,0.5);
      z-index: 2147483647; display: none; flex-direction: column;
      border: 1px solid #313244; border-right: none;
    }
    .gv-panel.open { display: flex; }
    .gv-header {
      background: #181825; padding: 10px 12px; border-bottom: 1px solid #313244;
      display: flex; justify-content: space-between; align-items: center;
      cursor: move; user-select: none;
    }
    .gv-header h1 { font-size: 15px; margin: 0; color: #cba6f7; }
    .gv-header-actions { display: flex; gap: 4px; align-items: center; }
    .gv-iconbtn { background: transparent; border: none; cursor: pointer; font-size: 14px; color: #a6adc8; padding: 0 4px; line-height: 1; }
    .gv-iconbtn:hover { color: #cdd6f4; }
    .gv-status { font-size: 10px; padding: 3px 7px; border-radius: 10px; background: #313244; color: #a6adc8; font-weight: 600; white-space: nowrap; }
    .gv-status.recording { background: #3d1a1a; color: #f38ba8; }
    .gv-body { display: flex; flex-direction: column; }
    .gv-controls { padding: 8px 12px; display: flex; gap: 6px; }
    .gv-btn { flex: 1; padding: 7px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: 0.2s; }
    .gv-stop { background: #f38ba8; color: #1e1e2e; }
    .gv-stop:hover { background: #eb6c86; }
    .gv-content { padding: 0 12px 10px 12px; max-height: 50vh; overflow-y: auto; }
    .gv-textarea { width: 100%; height: 90px; margin-bottom: 6px; border: 1px solid #313244; border-radius: 6px; padding: 8px; box-sizing: border-box; font-family: inherit; font-size: 11px; resize: vertical; background: #181825; color: #cdd6f4; }
    .gv-textarea::placeholder { color: #585b70; }
    .gv-h3 { font-size: 12px; margin: 6px 0 4px; color: #a6adc8; }
    .gv-result { background: #181825; border: 1px solid #313244; border-radius: 6px; padding: 8px; min-height: 60px; max-height: 160px; font-size: 12px; line-height: 1.4; overflow-y: auto; white-space: pre-wrap; color: #cdd6f4; }
    .gv-export { background: transparent; color: #cba6f7; border: 1px solid #cba6f7; display: none; width: 100%; margin-top: 8px; padding: 7px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .gv-export:hover { background: #cba6f7; color: #1e1e2e; }
    .gv-content::-webkit-scrollbar { width: 6px; }
    .gv-content::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'gv-panel';
  panel.innerHTML = `
    <div class="gv-header" id="gv-drag">
      <h1>✨ GustavIA</h1>
      <div class="gv-header-actions">
        <span class="gv-status" id="gv-status">Inactivo</span>
        <button class="gv-iconbtn" id="gv-close" title="Cerrar">✕</button>
      </div>
    </div>
    <div class="gv-body">
      <div class="gv-controls">
        <button class="gv-btn gv-stop" id="gv-stop" style="display:none">⏹ Detener</button>
        <button class="gv-btn" id="gv-restart" style="background:#d13438;color:#fff;">⏺ Iniciar Grabación</button>
      </div>
      <div class="gv-content">
        <textarea class="gv-textarea" id="gv-transcript" placeholder="Transcripción en vivo..." readonly></textarea>
        <div class="gv-h3">Resumen IA:</div>
        <div class="gv-result" id="gv-result">Esperando datos de la reunión...</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="gv-export" id="gv-export" style="margin-top:0;flex:1;">📄 .docx</button>
          <button class="gv-export" id="gv-export-md" style="margin-top:0;flex:1;">📝 .md</button>
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(panel);

  const $ = (id) => shadow.getElementById(id);
  const statusEl = $('gv-status');
  const transcriptEl = $('gv-transcript');
  const resultEl = $('gv-result');
  const stopBtn = $('gv-stop');
  const restartBtn = $('gv-restart');
  const exportBtn = $('gv-export');
  const exportMdBtn = $('gv-export-md');
  const closeBtn = $('gv-close');
  const dragHandle = $('gv-drag');

  let currentTranscript = '';
  let currentSummary = '';
  let currentStatus = 'Inactivo';
  let hasDragged = false;

  function saveState() {
    try {
      chrome.storage.local.set({
        gustavia_panel_state: {
          transcript: currentTranscript,
          summary: currentSummary,
          status: currentStatus,
          statusClass: statusEl.className,
          hasDragged,
          left: hasDragged ? panel.style.left : null,
          top: hasDragged ? panel.style.top : null
        }
      });
    } catch (e) {}
  }
  function restoreState() {
    try {
      chrome.storage.local.get('gustavia_panel_state', (data) => {
        const s = data && data.gustavia_panel_state;
        // Restaurar transcript/resumen de sesión anterior pero siempre en estado listo
        currentTranscript = s.transcript || '';
        currentSummary = s.summary || '';
        transcriptEl.value = currentTranscript;
        if (currentSummary) { resultEl.innerText = currentSummary; exportBtn.style.display = 'block'; exportMdBtn.style.display = 'block'; }
        // Siempre posición esquina superior derecha al abrir
        panel.style.left = 'auto'; panel.style.right = '0px'; panel.style.top = '0px';
        // Estado siempre limpio al cargar — syncWithBackground corrige si hay grabación activa real
        currentStatus = 'Inactivo';
        statusEl.innerText = currentStatus;
        statusEl.className = 'gv-status';
        stopBtn.style.display = 'none';
        setRecordingUI(false);
        syncWithBackground();
      });
    } catch (e) {}
  }

  function applyRecordingState(isRec) {
    if (isRec) {
      setStatus('🔴 Grabando en silencio', 'recording');
      stopBtn.style.display = 'block';
      setRecordingUI(true);
    } else if (currentStatus === '🔴 Grabando en silencio') {
      setStatus('Inactivo', '');
      stopBtn.style.display = 'none';
      setRecordingUI(false);
    }
  }

  function syncWithBackground() {
    try {
      chrome.runtime.sendMessage({ type: 'get-recording-state' }, (resp) => {
        if (chrome.runtime.lastError || !resp) return;
        applyRecordingState(resp.isRecording);
      });
    } catch (e) {}
  }

  function setStatus(text, cls) {
    currentStatus = text;
    statusEl.innerText = text;
    statusEl.className = 'gv-status ' + (cls || '');
    saveState();
  }

  function setRecordingUI(recording) {
    restartBtn.disabled = recording;
    restartBtn.style.opacity = recording ? '0.3' : '1';
    restartBtn.style.cursor = recording ? 'not-allowed' : 'pointer';
    restartBtn.style.background = '#d13438';
    restartBtn.style.color = '#fff';
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'capture-started') {
      setStatus('🔴 Grabando en silencio', 'recording');
      stopBtn.style.display = 'block';
      setRecordingUI(true);
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
      setRecordingUI(true);
      saveState();
    } else if (msg.type === 'capture-stopped') {
      setStatus('✅ Finalizado', '');
      stopBtn.style.display = 'none';
      setRecordingUI(false);
      currentSummary = msg.summary || '';
      if (msg.transcript) currentTranscript = msg.transcript;
      transcriptEl.value = currentTranscript;
      resultEl.innerText = currentSummary;
      exportBtn.style.display = 'block'; exportMdBtn.style.display = 'block';
      panel.classList.add('open');
      saveState();
    } else if (msg.type === 'capture-error') {
      setStatus('❌ Error', '');
      stopBtn.style.display = 'none';
      setRecordingUI(false);
      resultEl.innerText = 'Error: ' + msg.error;
      panel.classList.add('open');
      saveState();
    } else if (msg.type === 'toggle-panel') {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) syncWithBackground();
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

  // --- Generador de .docx sin librerías externas ---
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
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

  exportBtn.onclick = () => {
    const date = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    const blob = buildDocx(`Notas de Reunión GustavIA — ${date}`, currentSummary, currentTranscript);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GustavIA_${date}.docx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  exportMdBtn.onclick = () => {
    const date = new Date().toLocaleDateString('es-CO').replace(/\//g, '-');
    const content = `# Notas de Reunión — GustavIA\nFecha: ${date}\n\n## Resumen IA\n${currentSummary}\n\n---\n\n## Transcripción\n${currentTranscript}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GustavIA_${date}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  restartBtn.onclick = () => {
    if (currentStatus === '🔴 Grabando en silencio' || currentStatus === '⏳ Procesando IA...') return;
    currentTranscript = '';
    currentSummary = '';
    transcriptEl.value = '';
    resultEl.innerText = 'Esperando datos de la reunión...';
    exportBtn.style.display = 'none'; exportMdBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    setStatus('Iniciando...', '');
    chrome.runtime.sendMessage({ type: 'start-capture-request' });
  };

  closeBtn.onclick = () => { panel.classList.remove('open'); };

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
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; hasDragged = true; saveState(); }
  });

  restoreState();
})();
