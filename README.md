# ✨ GustavIA - Asistente de Reuniones Invisible

**GustavIA** es un plugin (extensión) de navegador que actúa como un "espía silencioso" para tus reuniones virtuales. Captura el audio de cualquier pestaña (Teams, Zoom Web, Google Meet, etc.), transcribe la conversación en tiempo real y genera un resumen inteligente con tareas y responsables, **sin que los demás participantes se den cuenta de que estás usando una IA**.

## 🚀 Características Principales

*   **Modo Fantasma (Indetectable):** No envía notificaciones a la plataforma de la reunión (no activa el banner de "Se está grabando").
*   **Universal:** Funciona con cualquier plataforma que se ejecute en el navegador.
*   **Resumen con IA:** Utiliza modelos de lenguaje (OpenCode Zen / OpenAI / Gemini) para extraer resumen ejecutivo, decisiones, tareas y preguntas abiertas.
*   **Exportación:** Descarga las notas completas en formato Markdown (`.md`).
*   **Arquitectura Offscreen:** Sigue grabando en segundo plano incluso si cierras la ventana del plugin.

---

## 🛠️ Tecnologías Utilizadas

*   **Manifest V3 (Chrome Extensions API):** El estándar moderno para extensiones de navegador.
*   **`chrome.tabCapture`:** API nativa que permite capturar el audio de una pestaña específica sin usar el micrófono.
*   **Offscreen Document API:** Permite crear un documento HTML invisible en segundo plano para mantener vivos los procesos de captura y llamadas a la API de IA.
*   **Web Speech API (`webkitSpeechRecognition`):** Utilizada para transcribir el audio de la pestaña a texto en tiempo real directamente en el navegador (gratis y local).
*   **Fetch API:** Para conectar con el proveedor de IA.
*   **HTML/CSS/JS Vanilla:** Para la interfaz del popup (sin frameworks, ultraligero).

---

## 🏗️ Arquitectura del Proyecto

La extensión está diseñada siguiendo un patrón de separación de responsabilidades para evitar bloqueos y mantener el modo invisible:

1.  **`popup.html / popup.js` (Interfaz):** Es lo que ve el usuario. Solo envía comandos (Iniciar/Detener) y recibe actualizaciones de texto. No hace la grabación.
2.  **`background.js` (Service Worker):** Actúa como orquestador. Crea el documento oculto y obtiene el ID del stream de audio de la pestaña activa.
3.  **`offscreen.html / offscreen.js` (El Motor Invisible):** Un documento HTML sin interfaz gráfica. Aquí es donde ocurre la magia: recibe el stream de audio, ejecuta el reconocimiento de voz y llama a la IA. Al estar en segundo plano, el usuario puede cerrar el popup y la grabación continúa.

---

## 💻 Despliegue en Localhost (Paso a Paso)

Sigue estos pasos para probar GustavIA en tu navegador:

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/GustavIA.git
cd GustavIA
```

### 2. Configurar tu API Key
Abre el archivo `offscreen.js` y busca la sección de configuración:

```javascript
const API_KEY = "TU_API_KEY_AQUI"; 
const API_URL = "https://opencode.ai/zen/v1/chat/completions";
const MODEL_ID = "big-pickle"; 
```

**Opción A (OpenCode Zen):** Consigue tu clave en opencode.ai/auth. (Nota: Los modelos gratuitos a veces bloquean llamadas externas, si falla, usa la Opción B).

**Opción B (OpenAI/Gemini):** Cambia la `API_URL` y el `MODEL_ID` por los de tu proveedor preferido (ej. `https://api.openai.com/v1/chat/completions` y `gpt-3.5-turbo`).

### 3. Añadir un icono
Asegúrate de tener un archivo `icon.png` (128x128 px) en la raíz de la carpeta. Si no tienes uno, puedes descargar cualquier icono gratuito de Flaticon o eliminar la línea `"default_icon"` del `manifest.json`.

### 4. Cargar la extensión en el navegador
1. Abre Chrome, Edge o Brave.
2. Ve a la barra de direcciones y escribe: `chrome://extensions/` (o `edge://extensions/`).
3. Activa el "Modo de desarrollador" (interruptor en la esquina superior derecha).
4. Haz clic en "Cargar descomprimida" (Load unpacked).
5. Selecciona la carpeta `GustavIA` que clonaste.

### 5. ¡A espiar (éticamente)!
1. Abre una pestaña con tu reunión (Teams, Meet, Zoom web).
2. Haz clic en el icono de GustavIA.
3. Pulsa "Iniciar Captura Invisible".
4. Nota: Chrome mostrará un indicador rojo en la pestaña (solo para ti). No compartas tu pantalla completa en la reunión para mantener el anonimato.
5. Al terminar, pulsa "Detener y Resumir" y luego "Exportar Notas".
