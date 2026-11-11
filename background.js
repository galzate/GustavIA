// background.js
let offscreenReady = false;
let pendingStreamId = null;

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

// Mensajes de los contextos
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Badge según eventos de captura
  if (message.type === 'capture-started') { startBadge(); return; }
  if (message.type === 'capture-stopped' || message.type === 'capture-error') { stopBadge(); return; }

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

  // Iniciar captura (desde popup o panel flotante)
  if (message.type === 'start-capture-request') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] ? tabs[0].id : null;
      if (!tabId) {
        chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo identificar la pestaña activa.' });
        return;
      }
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError || !streamId) {
          chrome.runtime.sendMessage({ type: 'capture-error', error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Error al capturar la pestaña.' });
          return;
        }
        handleStart(streamId);
      });
    });
    return;
  }

  // Parar captura (desde el panel flotante o popup)
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
      chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se pudo crear el documento de captura.' });
    }
  } else {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', data: streamId });
  }
}
