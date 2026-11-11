// background.js

// --- Badge titilante en el icono mientras se graba (vive en el service worker,
//     por eso sigue titilando aunque se cierre el popup) ---
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Gestionar badge según eventos de captura (funciona aunque el popup esté cerrado)
  if (message.type === 'capture-started') { startBadge(); }
  if (message.type === 'capture-stopped' || message.type === 'capture-error') { stopBadge(); }

  if (message.type === 'start-capture-request') {
    // El popup se ejecuta en un contexto de extensión, por lo que sender.tab
    // puede ser undefined. Obtenemos la pestaña activa de la ventana actual.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] ? tabs[0].id : null;
      if (tabId) {
        iniciarCaptura(tabId);
      } else {
        chrome.runtime.sendMessage({ type: 'capture-error', error: 'No se encontró una pestaña activa para capturar.' });
      }
    });
    return true;
  }
  
  if (message.type === 'stop-capture') {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
  }
});

async function iniciarCaptura(tabId) {
  // 1. Verificar si ya existe el documento oculto
  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenDocument = existingContexts.find(
    (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
  );

  // 2. Crear el documento oculto si no existe
  if (!offscreenDocument) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Capturar audio de la pestaña para transcripción',
    });
  }

  // 3. Obtener el ID del stream de audio de la pestaña activa
  try {
    let streamId;
    try {
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (e) {
      const m = (e && (e.message || e.toString())) || '';
      if (m.toLowerCase().includes('active stream')) {
        // Detener captura previa y reintentar
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
        await new Promise((r) => setTimeout(r, 600));
        streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
      } else {
        throw e;
      }
    }

    // 4. Enviar el ID al documento oculto para iniciar la magia
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'start-capture',
      data: streamId
    });
  } catch (error) {
    console.error("Error al obtener el stream de la pestaña:", error);
    const detail = (error && (error.message || error.toString())) ? (error.message || error.toString()) : "desconocido";
    chrome.runtime.sendMessage({ type: 'capture-error', error: `No se pudo capturar la pestaña: ${detail}` });
  }
}
