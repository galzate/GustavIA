let recognition;
let mediaStream = null;
let fullTranscript = "";
let mediaRecorder = null;
let recordedChunks = [];

// API keys cargadas desde config.js (ver offscreen.html)
const WHISPER_API_KEY = typeof GROQ_API_KEY !== 'undefined' ? GROQ_API_KEY : '';
const WHISPER_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";

const API_KEY = WHISPER_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_ID = "openai/gpt-oss-20b";

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;

  if (message.type === 'start-capture') {
    startCapture(message.data);
  }
  
  if (message.type === 'stop-capture') {
    stopCapture();
  }
});

async function startCapture(streamId) {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // Reproducir el audio capturado para que la pestaña no quede silenciada
    try {
      const audioEl = new Audio();
      audioEl.srcObject = mediaStream;
      audioEl.play().catch(() => {});
    } catch (e) {}

    // Grabación real del audio de la pestaña (para STT fiel)
    recordedChunks = [];
    try {
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start(1000);
    } catch (e) {
      console.warn('MediaRecorder no disponible:', e);
      mediaRecorder = null;
    }

    // Transcripción en tiempo real (mejor esfuerzo con Web Speech API)
    if ('webkitSpeechRecognition' in window) {
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            fullTranscript += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        chrome.runtime.sendMessage({ type: 'transcript-update', text: fullTranscript + interim });
      };

      recognition.onerror = (event) => console.error('Error de reconocimiento:', event.error);

      try { recognition.start(); } catch (e) { console.warn('recognition.start:', e); }
      chrome.runtime.sendMessage({ type: 'capture-started' });
    } else {
      chrome.runtime.sendMessage({ type: 'capture-started' });
    }
  } catch (error) {
    console.error('Error al capturar pestaña:', error);
    chrome.runtime.sendMessage({ type: 'capture-error', error: error.message });
  }
}

async function stopCapture() {
  if (recognition) { recognition.stop(); recognition = null; }

  let audioBlob = null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    await new Promise((resolve) => {
      mediaRecorder.onstop = () => resolve();
      mediaRecorder.stop();
    });
  }
  if (recordedChunks.length > 0) {
    audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
  }
  if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }

  // Si hay clave de Groq, transcribir el audio capturado de forma fiel
  if (audioBlob && WHISPER_API_KEY) {
    chrome.runtime.sendMessage({ type: 'generating-summary' });
    try {
      const text = await transcribeWithWhisper(audioBlob);
      if (text && text.trim()) fullTranscript = text;
      chrome.runtime.sendMessage({ type: 'transcript-update', text: fullTranscript });
    } catch (e) {
      console.error('Error en Whisper:', e);
      chrome.runtime.sendMessage({ type: 'capture-stopped', summary: `Error de Whisper: ${e.message || e}`, transcript: fullTranscript });
      return;
    }
  }

  if (fullTranscript.trim()) {
    chrome.runtime.sendMessage({ type: 'generating-summary' });
    await generateSummary(fullTranscript);
  } else if (!audioBlob) {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: 'No se grabó audio de la pestaña. Asegúrate de que el video tenga sonido y la pestaña no esté silenciada.', transcript: '' });
  } else {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: 'Whisper no devolvió texto. Revisa la consola del service worker.', transcript: '' });
  }
}

async function transcribeWithWhisper(blob) {
  const form = new FormData();
  form.append('file', blob, 'capture.webm');
  form.append('model', WHISPER_MODEL);
  form.append('language', 'es');

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
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { 
            role: "system", 
            content: "Eres GustavIA, un asistente experto. Genera un resumen de la reunión con: Resumen Ejecutivo, Decisiones, Tareas (con responsables) y Preguntas Abiertas. Usa Markdown." 
          },
          { role: "user", content: text }
        ]
      })
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const data = await response.json();
    const summary = data.choices[0].message.content;
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: summary, transcript: text });
  } catch (error) {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: `Error de API: ${error.message}`, transcript: text });
  }
}
