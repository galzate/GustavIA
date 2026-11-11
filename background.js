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

// Clic en el icono: iniciar/parar captura (gesto de usuario) + mostrar panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  // Asegurar que el panel esté visible
  const ensurePanel = async () => {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }); }
    catch (e) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' });
      } catch (err) { console.warn('No se pudo inyectar el panel:', err); }
    }
  };

  if (isRecording) {
    // Parar
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
    await ensurePanel();
    return;
  }

  // Iniciar captura: getMediaStreamId PRIMERO (preserva el gesto de usuario)
  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
  } catch (e) {
    const m = (e && (e.message || e.toString())) || '';
    if (m.toLowerCase().includes('active stream')) {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
      await new Promise((r) => setTimeout(r, 600));
      try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }); }
      catch (e2) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: (e2 && (e2.message || e2.toString())) || 'Error al capturar.' });
        await ensurePanel();
        return;
      }
    } else {
      chrome.runtime.sendMessage({ type: 'capture-error', error: m || 'Error al capturar la pestaña.' });
      await ensurePanel();
      return;
    }
  }
  if (!streamId) {
    chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo obtener el stream de la pestaña.' });
    await ensurePanel();
    return;
  }

  isRecording = true;
  startBadge();
  await ensurePanel();
  await handleStart(streamId);
});

// Mensajes de los contextos
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  // Parar captura (desde el panel flotante)
  if (message.type === 'stop-capture') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
    return;
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
      isRecording = false;
      stopBadge();
      chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo crear el documento de captura.' });
    }
  } else {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: streamId });
  }
}
