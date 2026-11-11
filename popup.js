const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const transcriptArea = document.getElementById('transcript');
const resultDiv = document.getElementById('result');
const exportBtn = document.getElementById('exportBtn');
const exportMdBtn = document.getElementById('exportMdBtn');

let currentTranscript = "";
let currentSummary = "";
let currentStatus = "Inactivo";

function saveState() {
  try {
    chrome.storage.local.set({
      gustavia_state: {
        transcript: currentTranscript,
        summary: currentSummary,
        status: currentStatus,
        statusClass: statusDiv.className
      }
    });
  } catch (e) {}
}

function restoreState() {
  try {
    chrome.storage.local.get('gustavia_state', (data) => {
      const s = data && data.gustavia_state;
      if (!s) return;
      currentTranscript = s.transcript || "";
      currentSummary = s.summary || "";
      currentStatus = s.status || "Inactivo";
      statusDiv.innerText = currentStatus;
      statusDiv.className = s.statusClass || "";
      transcriptArea.value = currentTranscript;
      if (currentSummary) {
        resultDiv.innerText = currentSummary;
        exportBtn.style.display = 'block'; exportMdBtn.style.display = 'block';
      }
      if (currentStatus === '🔴 Grabando en silencio') {
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      }
    });
  } catch (e) {}
}

// Escuchar mensajes del Offscreen/Background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'capture-started') {
    currentStatus = '🔴 Grabando en silencio';
    statusDiv.innerText = currentStatus;
    statusDiv.className = 'recording';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    saveState();
  }
  
  if (message.type === 'transcript-update') {
    currentTranscript = message.text || "";
    transcriptArea.value = currentTranscript;
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
    saveState();
  }
  
  if (message.type === 'generating-summary') {
    currentStatus = '⏳ Procesando IA...';
    statusDiv.innerText = currentStatus;
    statusDiv.className = '';
    stopBtn.style.display = 'none';
    saveState();
  }
  
  if (message.type === 'capture-stopped') {
    currentStatus = '✅ Finalizado';
    statusDiv.innerText = currentStatus;
    statusDiv.className = '';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    currentSummary = message.summary || "";
    if (message.transcript) currentTranscript = message.transcript;
    transcriptArea.value = currentTranscript;
    resultDiv.innerText = currentSummary;
    exportBtn.style.display = 'block'; exportMdBtn.style.display = 'block';
    saveState();
  }
  
  if (message.type === 'capture-error') {
    currentStatus = '❌ Error';
    statusDiv.innerText = currentStatus;
    statusDiv.className = '';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    resultDiv.innerText = 'Error: ' + message.error;
    saveState();
  }
});

startBtn.onclick = () => {
  // Reiniciar datos de la captura anterior
  currentTranscript = "";
  currentSummary = "";
  transcriptArea.value = "";
  resultDiv.innerText = "Esperando datos de la reunión...";
  exportBtn.style.display = 'none'; exportMdBtn.style.display = 'none';
  chrome.runtime.sendMessage({ type: 'start-capture-request' });
  currentStatus = 'Iniciando...';
  statusDiv.innerText = currentStatus;
  saveState();
};

stopBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: 'stop-capture' });
};

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
  const enc = new TextEncoder(); const parts = []; const cd = []; let off = 0;
  for (const { name, data } of files) {
    const nb = enc.encode(name); const db = enc.encode(data); const crc = crc32(db);
    const lh = new Uint8Array(30 + nb.length); const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, db.length, true);
    dv.setUint32(22, db.length, true); dv.setUint16(26, nb.length, true);
    lh.set(nb, 30); parts.push(lh, db);
    const ce = new Uint8Array(46 + nb.length); const cv = new DataView(ce.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, db.length, true); cv.setUint32(24, db.length, true);
    cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true);
    ce.set(nb, 46); cd.push(ce); off += lh.length + db.length;
  }
  const cdSize = cd.reduce((s, e) => s + e.length, 0);
  const eocd = new Uint8Array(22); const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true);
  return new Blob([...parts, ...cd, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function buildDocx(title, summary, transcript) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const paras = text => (text||'').split('\n').map(l => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('');
  const heading = (text, size) => `<w:p><w:r><w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t>${esc(text)}</w:t></w:r></w:p>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${heading(title,36)}<w:p/>${heading('Resumen IA',28)}${paras(summary)}<w:p/>${heading('Transcripción',28)}${paras(transcript)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`;
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

// Restaurar estado al abrir el popup
restoreState();
