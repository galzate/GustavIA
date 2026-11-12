// background.js
let offscreenReady = false;
let pendingStreamId = null;
let pendingLanguage = 'es';
let isRecording = false;

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

chrome.runtime.onInstalled.addListener(() => { stopBadge(); });
chrome.runtime.onStartup.addListener(() => { stopBadge(); });

// Clic en el icono: solo abre/cierra el panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  for (let i = 0; i < 3; i++) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
      return;
    } catch (e) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise((r) => setTimeout(r, 200));
        await chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
        return;
      } catch (err) {
        console.warn('No se pudo inyectar/mostrar el panel:', err);
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reenviar mensajes del offscreen al panel flotante
  const fromOffscreen = sender && sender.url && sender.url.includes('offscreen.html');
  if (fromOffscreen && ['capture-started','capture-error','capture-stopped','transcript-update','generating-summary','partial-summary-update'].includes(message.type)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    });
  }

  if (message.type === 'capture-started') { isRecording = true; startBadge(); return; }
  if (message.type === 'capture-stopped' || message.type === 'capture-error') { isRecording = false; stopBadge(); return; }

  if (message.type === 'offscreen-ready') {
    offscreenReady = true;
    if (pendingStreamId) {
      const sid = pendingStreamId;
      const lang = pendingLanguage;
      pendingStreamId = null;
      pendingLanguage = 'es';
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: sid, language: lang });
    }
    return;
  }

  if (message.type === 'start-capture-request') {
    if (isRecording) return;
    const lang = message.language || 'es';
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs && tabs[0] ? tabs[0].id : null;
      if (!tabId) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo identificar la pestaña activa.' });
        return;
      }
      try {
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        if (!streamId) throw new Error('Sin stream ID');
        isRecording = true;
        startBadge();
        handleStart(streamId, lang);
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: (e && e.message) || 'Error al capturar la pestaña.' });
      }
    });
    return;
  }

  if (message.type === 'stop-capture') {
    chrome.runtime.getContexts({}).then((ctxs) => {
      const hasDoc = ctxs.some((c) => c.contextType === 'OFFSCREEN_DOCUMENT');
      if (!hasDoc) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: 'El documento de captura se cerró. Recarga la página.' });
        return;
      }
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
    }).catch(() => {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
    });
    return;
  }

  if (message.type === 'get-recording-state') {
    sendResponse({ isRecording });
    return true;
  }

  // Google Drive upload (chrome.identity only available in background)
  if (message.type === 'drive-upload') {
    handleDriveUpload(message, sendResponse);
    return true;
  }

  if (message.type === 'get-active-tab-id') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs && tabs[0] ? tabs[0].id : null });
    });
    return true;
  }
});

async function handleStart(streamId, language = 'es') {
  const existing = await chrome.runtime.getContexts({});
  const hasDoc = existing.some((c) => c.contextType === 'OFFSCREEN_DOCUMENT');

  if (!hasDoc) {
    offscreenReady = false;
    pendingStreamId = streamId;
    pendingLanguage = language;
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capturar audio de la pestaña para transcripción',
      });
    } catch (error) {
      console.error('Error al crear documento oculto:', error);
      pendingStreamId = null;
      chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo crear el documento de captura.' });
    }
  } else {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: streamId, language });
  }
}

function handleDriveUpload(message, sendResponse) {
  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
    if (chrome.runtime.lastError || !token) {
      sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'No se pudo autenticar con Google Drive. Verifica el OAuth Client ID en manifest.json.' });
      return;
    }
    try {
      const { summary, transcript, date } = message;
      const content = `# Notas de Reunión — GustavIA\nFecha: ${date}\n\n## Resumen IA\n${summary}\n\n---\n\n## Transcripción\n${transcript}`;
      const filename = `GustavIA_${date}.md`;
      const metadata = { name: filename, mimeType: 'text/markdown' };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'text/markdown' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Drive API ${response.status}`);
      }
      const data = await response.json();
      sendResponse({ success: true, fileId: data.id, name: filename });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  });
}
