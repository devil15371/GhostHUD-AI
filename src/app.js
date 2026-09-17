/**
 * GhostHUD AI — Core Application Logic
 * Supports: Electron Desktop (Mac & Win), Web App (Chrome & Brave), Extension (V3)
 */

(function () {
  'use strict';

  // DOM Elements
  const container = document.getElementById('hud-container');
  const capsule = document.getElementById('hud-capsule');
  const windowEl = document.getElementById('hud-window');
  const headerEl = document.getElementById('hud-header');
  const ghostIndicator = document.getElementById('ghost-indicator');
  const messagesContainer = document.getElementById('messages-container');
  const welcomeCard = document.getElementById('welcome-card');
  const chatForm = document.getElementById('chat-form');
  const promptInput = document.getElementById('prompt-input');
  const btnSend = document.getElementById('btn-send');
  const btnAttach = document.getElementById('btn-attach');
  const fileInput = document.getElementById('file-input');
  const btnMic = document.getElementById('btn-mic');
  const imagePreviewBar = document.getElementById('image-preview-bar');
  const previewImage = document.getElementById('preview-image');
  const btnRemoveImage = document.getElementById('btn-remove-image');
  const quickPills = document.getElementById('quick-pills');

  // Header Buttons
  const btnPin = document.getElementById('btn-pin');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');
  const btnPip = document.getElementById('btn-pip');
  const btnSettings = document.getElementById('btn-settings');

  // Settings Elements
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKey = document.getElementById('btn-toggle-key-visibility');
  const selectModel = document.getElementById('select-model');
  const toggleGhostEnabled = document.getElementById('toggle-ghost-enabled');
  const sliderGhostOpacity = document.getElementById('slider-ghost-opacity');
  const valGhostOpacity = document.getElementById('val-ghost-opacity');
  const sliderGhostDelay = document.getElementById('slider-ghost-delay');
  const valGhostDelay = document.getElementById('val-ghost-delay');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Configuration State (stored in localStorage)
  const STORAGE_KEY = 'ghosthud_config_v1';
  let config = {
    apiKey: '',
    model: 'gemini-2.5-flash',
    ghostEnabled: true,
    ghostOpacity: 20, // percentage
    ghostDelay: 4,    // seconds
    alwaysOnTop: true,
    messages: []
  };

  // Runtime State
  let currentAttachedImage = null; // { mimeType, base64 }
  let ghostTimer = null;
  let isGhosted = false;
  let isGenerating = false;
  let isListening = false;
  let speechRecognition = null;

  // Detect platform runtime environment
  const isElectron = !!(window.ghostHUD && window.ghostHUD.isElectron);

  // Initialize
  init();

  function init() {
    loadConfig();
    setupEventListeners();
    setupGhostMode();
    setupSpeechRecognition();
    setupMarkdownAndMath();
    renderHistory();
    applyElectronPlatformStyles();
  }

  /* --------------------------------------------------------------------------
     Configuration Persistence
     -------------------------------------------------------------------------- */

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        config = { ...config, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load config from localStorage', e);
    }

    // Apply values to UI
    inputApiKey.value = config.apiKey || '';
    selectModel.value = config.model || 'gemini-2.5-flash';
    toggleGhostEnabled.checked = config.ghostEnabled !== false;
    sliderGhostOpacity.value = config.ghostOpacity || 20;
    valGhostOpacity.textContent = `${sliderGhostOpacity.value}%`;
    sliderGhostDelay.value = config.ghostDelay || 4;
    valGhostDelay.textContent = `${sliderGhostDelay.value}s`;

    applyGhostOpacityCSS(config.ghostOpacity);
  }

  function saveConfig() {
    config.apiKey = inputApiKey.value.trim();
    config.model = selectModel.value;
    config.ghostEnabled = toggleGhostEnabled.checked;
    config.ghostOpacity = parseInt(sliderGhostOpacity.value, 10);
    config.ghostDelay = parseInt(sliderGhostDelay.value, 10);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    applyGhostOpacityCSS(config.ghostOpacity);
    settingsModal.style.display = 'none';

    updateGhostIndicator();
  }

  function applyGhostOpacityCSS(opacityPercent) {
    const dec = Math.max(0.05, Math.min(0.8, opacityPercent / 100));
    document.documentElement.style.setProperty('--ghost-opacity', dec.toString());
  }

  function updateGhostIndicator() {
    if (!config.ghostEnabled) {
      ghostIndicator.style.display = 'none';
    } else {
      ghostIndicator.style.display = 'flex';
      if (isGhosted) {
        ghostIndicator.classList.add('ghosting');
        ghostIndicator.querySelector('.ghost-text').textContent = 'Ghosting';
      } else {
        ghostIndicator.classList.remove('ghosting');
        ghostIndicator.querySelector('.ghost-text').textContent = 'Ghost ON';
      }
    }
  }

  /* --------------------------------------------------------------------------
     Auto-Ghost Translucency Engine
     -------------------------------------------------------------------------- */

  function setupGhostMode() {
    const wakeUpEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'focus'];

    wakeUpEvents.forEach(evt => {
      window.addEventListener(evt, wakeFromGhost, { passive: true });
    });

    window.addEventListener('blur', () => {
      if (!isGenerating && !settingsModal.style.display.includes('flex')) {
        scheduleGhost(1500); // fade faster when window loses focus
      }
    });

    scheduleGhost();
  }

  function scheduleGhost(customDelayMs) {
    if (!config.ghostEnabled) return;
    clearTimeout(ghostTimer);

    const delay = customDelayMs !== undefined ? customDelayMs : config.ghostDelay * 1000;
    ghostTimer = setTimeout(enterGhostMode, delay);
  }

  function enterGhostMode() {
    if (!config.ghostEnabled || isGenerating) return;
    // Don't ghost if settings modal is open or user is actively typing
    if (settingsModal.style.display === 'flex' || document.activeElement === promptInput && promptInput.value.length > 0) {
      return;
    }

    isGhosted = true;
    container.classList.add('is-ghost');
    updateGhostIndicator();

    if (isElectron && window.ghostHUD.setOpacity) {
      window.ghostHUD.setOpacity(config.ghostOpacity / 100);
    }
  }

  function wakeFromGhost() {
    if (isGhosted) {
      isGhosted = false;
      container.classList.remove('is-ghost');
      updateGhostIndicator();

      if (isElectron && window.ghostHUD.setOpacity) {
        window.ghostHUD.setOpacity(1.0);
      }
    }
    scheduleGhost();
  }

  /* --------------------------------------------------------------------------
     Clipboard & Image Handling (Screenshots via Cmd+V / Ctrl+V)
     -------------------------------------------------------------------------- */

  function setupEventListeners() {
    // Paste handler for screenshots
    window.addEventListener('paste', handlePaste);

    // Drag and Drop for images
    windowEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      windowEl.classList.add('drag-over');
    });

    windowEl.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      windowEl.classList.remove('drag-over');
    });

    windowEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      windowEl.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0]);
      }
    });

    // File input attach button
    btnAttach.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
      }
    });

    // Remove attached image
    btnRemoveImage.addEventListener('click', clearAttachedImage);

    // Form submit
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendUserQuery();
    });

    // Textarea enter key submit (Shift+Enter for newline)
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserQuery();
      }
    });

    // Quick Lecture Action Pills
    quickPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-chip');
      if (!btn) return;
      const promptText = btn.getAttribute('data-prompt');
      if (currentAttachedImage) {
        sendUserQuery(promptText);
      } else {
        promptInput.value = promptText;
        promptInput.focus();
      }
    });

    // Settings Modal
    btnSettings.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      wakeFromGhost();
    });
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
      scheduleGhost();
    });
    btnSaveSettings.addEventListener('click', saveConfig);

    btnToggleKey.addEventListener('click', () => {
      inputApiKey.type = inputApiKey.type === 'password' ? 'text' : 'password';
    });

    sliderGhostOpacity.addEventListener('input', (e) => {
      valGhostOpacity.textContent = `${e.target.value}%`;
      applyGhostOpacityCSS(e.target.value);
    });

    sliderGhostDelay.addEventListener('input', (e) => {
      valGhostDelay.textContent = `${e.target.value}s`;
    });

    btnClearHistory.addEventListener('click', () => {
      if (confirm('Clear all conversation messages?')) {
        config.messages = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        renderHistory();
        settingsModal.style.display = 'none';
      }
    });

    // Window controls
    btnMinimize.addEventListener('click', toggleMiniCapsule);
    capsule.addEventListener('click', toggleMiniCapsule);

    if (btnPin) {
      btnPin.addEventListener('click', () => {
        config.alwaysOnTop = !config.alwaysOnTop;
        btnPin.classList.toggle('active', config.alwaysOnTop);
        if (isElectron && window.ghostHUD.setAlwaysOnTop) {
          window.ghostHUD.setAlwaysOnTop(config.alwaysOnTop);
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (isElectron && window.ghostHUD.hide) {
          window.ghostHUD.hide();
        } else {
          // In web mode, collapse to mini capsule
          toggleMiniCapsule();
        }
      });
    }

    // Document Picture-in-Picture trigger (for Chrome / Brave)
    if (btnPip) {
      if ('documentPictureInPicture' in window) {
        btnPip.addEventListener('click', () => {
          if (window.ghostHUD_PiP) {
            window.ghostHUD_PiP.requestPiP();
          }
        });
      } else {
        // PiP not available in non-Chromium browsers or already in PiP window
        btnPip.style.display = 'none';
      }
    }
  }

  function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        handleImageFile(blob);
        wakeFromGhost();
        break;
      }
    }
  }

  function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const dataUrl = evt.target.result;
      const base64Data = dataUrl.split(',')[1];
      currentAttachedImage = {
        mimeType: file.type,
        base64: base64Data,
        previewUrl: dataUrl
      };

      previewImage.src = dataUrl;
      imagePreviewBar.style.display = 'flex';
      promptInput.placeholder = 'Ask anything about this screenshot/slide...';
      promptInput.focus();
    };
    reader.readAsDataURL(file);
  }

  function clearAttachedImage() {
    currentAttachedImage = null;
    imagePreviewBar.style.display = 'none';
    previewImage.src = '';
    fileInput.value = '';
    promptInput.placeholder = 'Ask a doubt or paste screenshot (Cmd+V)...';
  }

  function toggleMiniCapsule() {
    container.classList.toggle('is-minimized');
    wakeFromGhost();
  }

  /* --------------------------------------------------------------------------
     Voice / Speech Recognition (Hands-Free Lecture Doubts)
     -------------------------------------------------------------------------- */

  function setupSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      btnMic.style.display = 'none';
      return;
    }

    speechRecognition = new SpeechRec();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isListening = true;
      btnMic.classList.add('listening');
    };

    speechRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      promptInput.value = transcript;
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopListening();
    };

    speechRecognition.onend = () => {
      stopListening();
      if (promptInput.value.trim().length > 0) {
        sendUserQuery();
      }
    };

    btnMic.addEventListener('click', () => {
      if (isListening) {
        speechRecognition.stop();
      } else {
        speechRecognition.start();
      }
    });
  }

  function stopListening() {
    isListening = false;
    btnMic.classList.remove('listening');
  }

  /* --------------------------------------------------------------------------
     Markdown & LaTeX Math Formatting Setup
     -------------------------------------------------------------------------- */

  function setupMarkdownAndMath() {
    if (window.marked) {
      window.marked.setOptions({
        gfm: true,
        breaks: true
      });
    }
  }

  function formatContent(text) {
    if (!text) return '';

    // Step 1: Render math formulas with KaTeX if present ($...$ and $$...$$)
    let processed = text;
    if (window.katex) {
      // Display math: $$...$$
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        try {
          return window.katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
        } catch (e) {
          return match;
        }
      });

      // Inline math: $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        try {
          return window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
        } catch (e) {
          return match;
        }
      });
    }

    // Step 2: Markdown parsing
    if (window.marked) {
      try {
        return window.marked.parse(processed);
      } catch (e) {
        return escapeHtml(processed);
      }
    }

    return escapeHtml(processed);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* --------------------------------------------------------------------------
     Chat & Gemini AI Engine
     -------------------------------------------------------------------------- */

  async function sendUserQuery(overridePrompt) {
    const query = (overridePrompt || promptInput.value).trim();
    const attached = currentAttachedImage;

    if (!query && !attached) return;
    if (isGenerating) return;

    // Clear input bar
    promptInput.value = '';
    clearAttachedImage();
    welcomeCard.style.display = 'none';

    // Add user message to UI & history
    const userMsg = {
      role: 'user',
      text: query || 'Explain this lecture screenshot:',
      image: attached ? attached.previewUrl : null,
      timestamp: Date.now()
    };
    appendMessage(userMsg);
    config.messages.push(userMsg);

    // Prepare assistant response placeholder
    const assistantMsg = {
      role: 'assistant',
      text: '',
      timestamp: Date.now()
    };
    const { bubbleEl, itemEl } = appendMessage(assistantMsg, true);

    isGenerating = true;
    btnSend.disabled = true;

    try {
      if (config.apiKey) {
        await callGeminiApi(query, attached, bubbleEl, itemEl);
      } else {
        await callSmartDemoMode(query, attached, bubbleEl, itemEl);
      }
    } catch (err) {
      console.error('Gemini error:', err);
      bubbleEl.innerHTML = `
        <div style="color: var(--accent-rose); font-weight: 500;">
          ⚠️ ${escapeHtml(err.message || 'Error communicating with Gemini API')}
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: var(--text-dim);">
          Check your API Key in Settings (⚙️). You can get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--accent-cyan);">Google AI Studio</a>.
        </div>
      `;
    } finally {
      isGenerating = false;
      btnSend.disabled = false;
      scheduleGhost();
    }
  }

  /**
   * Official Gemini 1.5/2.5 Flash API Caller with Streaming / Instant response
   */
  async function callGeminiApi(promptText, attachedImage, bubbleEl, itemEl) {
    const model = config.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    // System instruction tailored for quick lecture doubt clearing
    const systemPrompt = "You are GhostHUD AI, an ultra-fast, concise floating lecture companion. The student is watching a class or reading notes. Deliver crystal-clear explanations. Format key formulas with LaTeX ($...$ and $$...$$). Keep responses concise, structured, and easy to read in 10 seconds. Bold crucial terms.";

    const parts = [];

    // Add image if attached
    if (attachedImage && attachedImage.base64) {
      parts.push({
        inlineData: {
          mimeType: attachedImage.mimeType || 'image/png',
          data: attachedImage.base64
        }
      });
    }

    // Add text prompt
    parts.push({
      text: promptText || "Analyze this lecture slide/image. Summarize key concepts, equations, and main takeaways."
    });

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `API error ${response.status}: ${response.statusText}`;
      throw new Error(msg);
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    // Render formatted markdown + math
    bubbleEl.innerHTML = formatContent(reply);
    attachCopyAction(itemEl, reply);

    // Save in history
    config.messages.push({
      role: 'assistant',
      text: reply,
      timestamp: Date.now()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  /**
   * Smart Demo Mode (Runs if the user hasn't entered an API key yet)
   */
  async function callSmartDemoMode(promptText, attachedImage, bubbleEl, itemEl) {
    // Show typing simulation
    await new Promise(r => setTimeout(r, 600));

    let reply = '';
    const q = (promptText || '').toLowerCase();

    if (attachedImage) {
      reply = `**Screenshot Analyzed (Demo Mode)** 📸\n\n- **Slide Topic Detected:** Core Academic Concept\n- **Formula Reference:** $$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$$\n- **Key Takeaway:** The visual elements represent the fundamental principles being discussed in the lecture.\n\n> 💡 *To unlock real-time live vision reasoning with Gemini 2.5 Flash, add your free key in Settings (⚙️).*`;
    } else if (q.includes('formula') || q.includes('math') || q.includes('equation')) {
      reply = `**Mathematical Breakdown** 📐\n\nConsider the standard quadratic & calculus relations:\n\n$$f(x) = ax^2 + bx + c \\implies f'(x) = 2ax + b$$\n\n- **Variables:** $x$ represents the independent parameter.\n- **Derivative:** $f'(x)$ gives the instantaneous rate of change (slope) at any lecture timestamp.\n\n*Tip: Connect your free Gemini API key in Settings to solve any custom lecture problem!*`;
    } else if (q.includes('bullet') || q.includes('summary')) {
      reply = `**Quick Lecture Takeaways** 📝\n\n1. **Core Concept:** Primary definition discussed during this segment.\n2. **Practical Utility:** Why this mechanism or theory is used in practice.\n3. **Exam Focus:** Keep this relationship memorized for quick recall.`;
    } else {
      reply = `**Concept Clarification** ⚡\n\n* **Definition:** A direct, high-level mechanism designed for solving the exact doubt you encountered.\n* **Analogy:** Think of it like a pipeline or highway that directs flow without bottlenecking.\n\n> 🔑 **Pro-Tip:** GhostHUD is running in instant Demo Mode. Add your 100% free key from [Google AI Studio](https://aistudio.google.com/app/apikey) in **Settings (⚙️)** to ask ANY lecture doubt!`;
    }

    bubbleEl.innerHTML = formatContent(reply);
    attachCopyAction(itemEl, reply);

    config.messages.push({
      role: 'assistant',
      text: reply,
      timestamp: Date.now()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function appendMessage(msg, isPending = false) {
    const itemEl = document.createElement('div');
    itemEl.className = `msg-item ${msg.role}`;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'msg-bubble';

    if (isPending) {
      bubbleEl.innerHTML = `
        <div class="typing-dots">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      `;
    } else {
      // If user uploaded an image
      if (msg.image) {
        const img = document.createElement('img');
        img.src = msg.image;
        img.className = 'msg-image-thumb';
        img.alt = 'Attached screenshot';
        bubbleEl.appendChild(img);
      }

      const textContainer = document.createElement('div');
      textContainer.innerHTML = msg.role === 'assistant' ? formatContent(msg.text) : escapeHtml(msg.text);
      bubbleEl.appendChild(textContainer);
    }

    itemEl.appendChild(bubbleEl);
    messagesContainer.appendChild(itemEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!isPending && msg.role === 'assistant') {
      attachCopyAction(itemEl, msg.text);
    }

    return { itemEl, bubbleEl };
  }

  function attachCopyAction(itemEl, textToCopy) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    `;

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(textToCopy);
      copyBtn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.querySelector('span').textContent = 'Copy';
      }, 1500);
    });

    actionsEl.appendChild(copyBtn);
    itemEl.appendChild(actionsEl);
  }

  function renderHistory() {
    messagesContainer.innerHTML = '';
    if (!config.messages || config.messages.length === 0) {
      messagesContainer.appendChild(welcomeCard);
      welcomeCard.style.display = 'flex';
      return;
    }
    welcomeCard.style.display = 'none';

    // Show recent messages
    const recent = config.messages.slice(-25);
    recent.forEach(msg => appendMessage(msg));
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /* --------------------------------------------------------------------------
     Platform Tweaks (Electron vs Browser)
     -------------------------------------------------------------------------- */

  function applyElectronPlatformStyles() {
    if (isElectron) {
      document.body.classList.add('platform-electron');
      // In electron desktop app, hide web PiP button because it's already a native floating window
      if (btnPip) btnPip.style.display = 'none';
    } else {
      // In Web / Browser extension mode
      document.body.classList.add('platform-web');
      // Close button can hide or minimize
      if (btnClose && !isElectron) {
        btnClose.title = 'Minimize';
      }
    }
  }

})();
