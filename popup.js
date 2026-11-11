const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const transcriptArea = document.getElementById('transcript');
const resultDiv = document.getElementById('result');
const exportBtn = document.getElementById('exportBtn');

let currentTranscript = "";
let currentSummary = "";

// Escuchar mensajes del Offscreen/Background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'capture-started') {
    statusDiv.innerText = '🔴 Grabando en silencio';
    statusDiv.className = 'recording';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  }
  
  if (message.type === 'transcript-update') {
    transcriptArea.value = message.text;
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
    currentTranscript = message.text;
  }
  
  if (message.type === 'generating-summary') {
    statusDiv.innerText = '⏳ Procesando IA...';
    statusDiv.className = '';
    stopBtn.style.display = 'none';
  }
  
  if (message.type === 'capture-stopped') {
    statusDiv.innerText = '✅ Finalizado';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    currentSummary = message.summary;
    resultDiv.innerText = currentSummary;
    exportBtn.style.display = 'block';
  }
  
  if (message.type === 'capture-error') {
    statusDiv.innerText = '❌ Error';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    resultDiv.innerText = 'Error: ' + message.error;
  }
});

startBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: 'start-capture-request' });
  statusDiv.innerText = 'Iniciando...';
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
