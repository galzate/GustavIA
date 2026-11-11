const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const transcriptArea = document.getElementById('transcript');
const resultDiv = document.getElementById('result');
const exportBtn = document.getElementById('exportBtn');

let currentTranscript = "";
let currentSummary = "";
let currentStatus = "Inactivo";

// --- Badge titilante en el icono mientras se graba ---
let badgeInterval = null;
function startBadge() {
  if (badgeInterval) clearInterval(badgeInterval);
  try { chrome.action.setBadgeBackgroundColor({ color: '#d13438' }); } catch (e) {}
  let on = true;
  try { chrome.action.setBadgeText({ text: 'REC' }); } catch (e) {}
  badgeInterval = setInterval(() => {
    on = !on;
    try { chrome.action.setBadgeText({ text: on ? 'REC' : '' }); } catch (e) {}
  }, 600);
}
function stopBadge() {
  if (badgeInterval) { clearInterval(badgeInterval); badgeInterval = null; }
  try { chrome.action.setBadgeText({ text: '' }); } catch (e) {}
}

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
        exportBtn.style.display = 'block';
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
    startBadge();
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
    exportBtn.style.display = 'block';
    stopBadge();
    saveState();
  }
  
  if (message.type === 'capture-error') {
    currentStatus = '❌ Error';
    statusDiv.innerText = currentStatus;
    statusDiv.className = '';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    stopBadge();
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
  exportBtn.style.display = 'none';
  chrome.runtime.sendMessage({ type: 'start-capture-request' });
  currentStatus = 'Iniciando...';
  statusDiv.innerText = currentStatus;
  saveState();
};

stopBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: 'stop-capture' });
};

exportBtn.onclick = () => {
  const date = new Date().toLocaleDateString().replace(/\//g, '-');
  const content = `# Notas de Reunión - GustavIA\nFecha: ${date}\n\n## Resumen IA\n${currentSummary}\n\n---\n\n## Transcripción\n${currentTranscript}`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GustavIA_${date}.md`;
  a.click();
};

// Restaurar estado al abrir el popup; limpiar badge residual
restoreState();
stopBadge();
