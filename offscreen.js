let recognition;
let mediaStream = null;
let fullTranscript = "";
let whisperTranscript = "";
let mediaRecorder = null;
let recordedChunks = [];
let captureLanguage = 'es';
let chunkTimer = null;
let partialTimer = null;
let lastPartialLen = 0;

const CHUNK_MS = 5 * 60 * 1000;   // 5 min segments
const PARTIAL_MS = 3 * 60 * 1000; // 3 min partial summary check

const WHISPER_API_KEY = typeof GROQ_API_KEY !== 'undefined' ? GROQ_API_KEY : '';
const WHISPER_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";
const API_KEY = WHISPER_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_ID = "openai/gpt-oss-20b";
const DEFAULT_PROMPT = "Eres GustavIA, un asistente experto. Genera un resumen de la reunión con: Resumen Ejecutivo, Decisiones, Tareas (con responsables) y Preguntas Abiertas. Usa Markdown.";

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;
  if (message.type === 'start-capture') {
    captureLanguage = message.language || 'es';
    startCapture(message.data);
  }
  if (message.type === 'stop-capture') {
    stopCapture();
  }
});

function whisperLang(lang) {
  if (lang === 'en') return 'en';
  if (lang === 'auto') return null;
  return 'es';
}

function speechLang(lang) {
  if (lang === 'en') return 'en-US';
  return 'es-ES';
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('gustavia_settings', (d) => resolve((d && d.gustavia_settings) || {}));
  });
}

async function startCapture(streamId) {
  fullTranscript = "";
  whisperTranscript = "";
  lastPartialLen = 0;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false
    });

    try {
      const audioEl = new Audio();
      audioEl.srcObject = mediaStream;
      audioEl.play().catch(() => {});
    } catch (e) {}

    startMediaRecorder();
    startChunkTimer();

    if ('webkitSpeechRecognition' in window) {
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang(captureLanguage);

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) fullTranscript += t + ' ';
          else interim += t;
        }
        chrome.runtime.sendMessage({ type: 'transcript-update', text: fullTranscript + interim });
      };

      recognition.onerror = (e) => console.error('Speech error:', e.error);
      try { recognition.start(); } catch (e) { console.warn('recognition.start:', e); }
    }

    chrome.runtime.sendMessage({ type: 'capture-started' });
    startPartialTimer();
  } catch (error) {
    console.error('Error al capturar pestaña:', error);
    chrome.runtime.sendMessage({ type: 'capture-error', error: error.message });
  }
}

function startMediaRecorder() {
  recordedChunks = [];
  try {
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.start(1000);
  } catch (e) {
    console.warn('MediaRecorder no disponible:', e);
    mediaRecorder = null;
  }
}

function startChunkTimer() {
  if (chunkTimer) clearInterval(chunkTimer);
  chunkTimer = setInterval(async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive' || !mediaStream) return;
    const blob = await stopMediaRecorderAndCollect();
    if (blob && WHISPER_API_KEY) {
      try {
        const text = await transcribeWithWhisper(blob);
        if (text && text.trim()) {
          whisperTranscript += ' ' + text;
          chrome.runtime.sendMessage({ type: 'transcript-update', text: whisperTranscript.trim() });
        }
      } catch (e) { console.error('Whisper chunk error:', e); }
    }
    if (mediaStream) startMediaRecorder();
  }, CHUNK_MS);
}

function stopChunkTimer() {
  if (chunkTimer) { clearInterval(chunkTimer); chunkTimer = null; }
}

async function stopMediaRecorderAndCollect() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;
  const chunks = [...recordedChunks];
  recordedChunks = [];
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => resolve(chunks.length > 0 ? new Blob(chunks, { type: 'audio/webm' }) : null);
    mediaRecorder.stop();
  });
}

function startPartialTimer() {
  if (partialTimer) clearInterval(partialTimer);
  partialTimer = setInterval(async () => {
    const text = (whisperTranscript || fullTranscript).trim();
    if (!text || !API_KEY) return;
    if (text.length - lastPartialLen < 300) return;
    lastPartialLen = text.length;
    try {
      const settings = await getSettings();
      const privacyNote = settings.privacyMode ? ' Reemplaza nombres propios de personas con [Persona A], [Persona B], etc.' : '';
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [
            { role: "system", content: "Genera un resumen ejecutivo breve (máximo 150 palabras) de lo hablado hasta ahora. Usa Markdown." + privacyNote },
            { role: "user", content: text }
          ]
        })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      chrome.runtime.sendMessage({ type: 'partial-summary-update', text: data.choices[0].message.content });
    } catch (e) { console.error('Partial summary error:', e); }
  }, PARTIAL_MS);
}

function stopPartialTimer() {
  if (partialTimer) { clearInterval(partialTimer); partialTimer = null; }
}

async function stopCapture() {
  if (recognition) { recognition.stop(); recognition = null; }
  stopChunkTimer();
  stopPartialTimer();

  const lastBlob = await stopMediaRecorderAndCollect();
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }

  if (lastBlob && WHISPER_API_KEY) {
    chrome.runtime.sendMessage({ type: 'generating-summary' });
    try {
      const text = await transcribeWithWhisper(lastBlob);
      if (text && text.trim()) whisperTranscript += ' ' + text;
    } catch (e) {
      console.error('Error en Whisper final:', e);
      chrome.runtime.sendMessage({ type: 'capture-stopped', summary: `Error de Whisper: ${e.message || e}`, transcript: fullTranscript });
      return;
    }
  }

  const finalTranscript = whisperTranscript.trim() || fullTranscript.trim();

  if (finalTranscript) {
    chrome.runtime.sendMessage({ type: 'transcript-update', text: finalTranscript });
    chrome.runtime.sendMessage({ type: 'generating-summary' });
    await generateSummary(finalTranscript);
  } else if (!lastBlob) {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: 'No se grabó audio de la pestaña. Asegúrate de que el video tenga sonido y la pestaña no esté silenciada.', transcript: '' });
  } else {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: 'Whisper no devolvió texto. Revisa la consola del service worker.', transcript: '' });
  }
}

async function transcribeWithWhisper(blob) {
  const form = new FormData();
  form.append('file', blob, 'capture.webm');
  form.append('model', WHISPER_MODEL);
  const lc = whisperLang(captureLanguage);
  if (lc) form.append('language', lc);

  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHISPER_API_KEY}` },
    body: form
  });
  if (!response.ok) throw new Error(`Whisper HTTP ${response.status}`);
  const data = await response.json();
  return data.text || '';
}

async function generateSummary(text) {
  try {
    const settings = await getSettings();
    const customPrompt = settings.customPrompt || DEFAULT_PROMPT;
    const privacyNote = settings.privacyMode
      ? ' Reemplaza todos los nombres propios de personas con [Persona A], [Persona B], etc., de forma consistente.'
      : '';

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: customPrompt + privacyNote },
          { role: "user", content: text }
        ]
      })
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: data.choices[0].message.content, transcript: text });
  } catch (error) {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: `Error de API: ${error.message}`, transcript: text });
  }
}
