// background.js
let offscreenReady = false;
let pendingStreamId = null;
let isRecording = false;

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

chrome.runtime.onInstalled.addListener(() => { stopBadge(); });
chrome.runtime.onStartup.addListener(() => { stopBadge(); });

// Clic en el icono: solo abre/cierra el panel — el usuario controla la grabación
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

// Mensajes de los contextos
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Reenviar mensajes del offscreen document a la pestaña activa (garantiza entrega al panel flotante)
  const fromOffscreen = sender && sender.url && sender.url.includes('offscreen.html');
  if (fromOffscreen && ['capture-started','capture-error','capture-stopped','transcript-update','generating-summary'].includes(message.type)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  }

  // Badge según eventos de captura
  if (message.type === 'capture-started') { isRecording = true; startBadge(); return; }
  if (message.type === 'capture-stopped' || message.type === 'capture-error') { isRecording = false; stopBadge(); return; }

  // offscreen ready handshake
  if (message.type === 'offscreen-ready') {
    offscreenReady = true;
    if (pendingStreamId) {
      const sid = pendingStreamId;
      pendingStreamId = null;
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: sid });
    }
    return;
  }

  // Iniciar captura (desde el panel flotante — botón Iniciar Grabación)
  if (message.type === 'start-capture-request') {
    if (isRecording) return;
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
        handleStart(streamId);
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: (e && e.message) || 'Error al capturar la pestaña.' });
      }
    });
    return;
  }

  // Parar captura (desde el panel flotante o popup)
  if (message.type === 'stop-capture') {
    const existing = chrome.runtime.getContexts ? null : null;
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

  // Estado de grabación (para sincronizar el panel al abrirse)
  if (message.type === 'get-recording-state') {
    sendResponse({ isRecording });
    return true;
  }

  // get-active-tab-id
  if (message.type === 'get-active-tab-id') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tabId: tabs && tabs[0] ? tabs[0].id : null });
    });
    return true;
  }
});

async function handleStart(streamId) {
  const existing = await chrome.runtime.getContexts({});
  const hasDoc = existing.some((c) => c.contextType === 'OFFSCREEN_DOCUMENT');

  if (!hasDoc) {
    offscreenReady = false;
    pendingStreamId = streamId;
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
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: streamId });
  }
}
