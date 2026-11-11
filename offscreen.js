let recognition;
let mediaStream = null;
let fullTranscript = "";

// Configuración de IA (OpenCode Zen)
const API_KEY = "TU_API_KEY_AQUI"; 
const API_URL = "https://opencode.ai/zen/v1/chat/completions";
const MODEL_ID = "big-pickle"; 

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

      recognition.start();
      chrome.runtime.sendMessage({ type: 'capture-started' });
    }
  } catch (error) {
    console.error('Error al capturar pestaña:', error);
    chrome.runtime.sendMessage({ type: 'capture-error', error: error.message });
  }
}

async function stopCapture() {
  if (recognition) { recognition.stop(); recognition = null; }
  if (mediaStream) { mediaStream.getTracks().forEach(track => track.stop()); mediaStream = null; }

  if (fullTranscript.trim()) {
    chrome.runtime.sendMessage({ type: 'generating-summary' });
    await generateSummary(fullTranscript);
  } else {
    chrome.runtime.sendMessage({ type: 'capture-stopped', summary: 'No se detectó audio.' });
  }
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
