/**
 * Koko — Human-Crafted Anime Study Companion
 * Features:
 * - Idle Cute Floating Anime Mascot Mode (100% unobtrusive on laptop screens)
 * - Secure Gemini API Proxy (Keys hidden & protected in backend)
 * - Screenshot Doubt Solving (Cmd+V / Ctrl+V)
 * - KaTeX Math & Markdown Parsing
 */

(function () {
  'use strict';

  // DOM Elements
  const container = document.getElementById('hud-container');
  const mascotStage = document.getElementById('mascot-stage');
  const mascotBubble = document.getElementById('mascot-bubble');
  const mascotSpeechText = document.getElementById('mascot-speech-text');
  const windowEl = document.getElementById('hud-window');
  const chatFeed = document.getElementById('chat-feed');
  const welcomeCard = document.getElementById('welcome-card');
  const chatForm = document.getElementById('chat-form');
  const promptInput = document.getElementById('prompt-input');
  const btnSend = document.getElementById('btn-send');
  const btnAttach = document.getElementById('btn-attach');
  const fileInput = document.getElementById('file-input');
  const btnMic = document.getElementById('btn-mic');
  const attachPreviewBar = document.getElementById('attach-preview-bar');
  const previewThumbImg = document.getElementById('preview-thumb-img');
  const btnClearThumb = document.getElementById('btn-clear-thumb');
  const quickChips = document.getElementById('quick-chips');

  // Header Actions
  const btnToMascot = document.getElementById('btn-to-mascot');
  const btnPin = document.getElementById('btn-pin');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('btn-close');
  const btnPip = document.getElementById('btn-pip');

  // Settings Elements
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKeyEye = document.getElementById('btn-toggle-key-eye');
  const selectModel = document.getElementById('select-model');
  const toggleMascotIdle = document.getElementById('toggle-mascot-idle');
  const sliderMascotDelay = document.getElementById('slider-mascot-delay');
  const valMascotDelay = document.getElementById('val-mascot-delay');
  const sliderGhostOpacity = document.getElementById('slider-ghost-opacity');
  const valGhostOpacity = document.getElementById('val-ghost-opacity');
  const btnClearChat = document.getElementById('btn-clear-chat');

  // State
  const STORAGE_KEY = 'koko_companion_v2';
  let config = {
    model: 'gemini-2.5-flash',
    mascotIdleEnabled: true,
    mascotDelay: 4,      // seconds before curling into anime mascot
    mascotOpacity: 85,   // opacity percentage
    alwaysOnTop: true,
    messages: []
  };

  let currentAttachedImage = null; // { mimeType, base64, previewUrl }
  let idleTimer = null;
  let isMascotMode = false;
  let isThinking = false;
  let speechRec = null;

  const isElectron = !!(window.ghostHUD && window.ghostHUD.isElectron);

  // Mascot playful thoughts when idle
  const cuteThoughts = [
    "Watching lecture... 🎧",
    "Got a tough question? Click me! ✨",
    "Need this formula deconstructed? 📐",
    "Paste a screenshot with Cmd+V! 📸",
    "Taking notes alongside you ✏️",
    "Listening intently... 🍵"
  ];

  init();

  async function init() {
    loadConfig();
    setupEvents();
    setupMascotIdleTimer();
    setupSpeech();
    setupMarkdownMath();
    renderChatHistory();

    // Check if secure backend has API key
    if (isElectron && window.ghostHUD.hasApiKey) {
      const hasKey = await window.ghostHUD.hasApiKey();
      if (hasKey) {
        inputApiKey.placeholder = '•••••••••••••••• (Key safely configured)';
      }
    }

    // Listen for IPC mode changes or global wakeups from Electron
    if (isElectron) {
      if (window.ghostHUD.onModeChanged) {
        window.ghostHUD.onModeChanged((mode) => {
          if (mode === 'mascot') enterMascotMode(false);
          else wakeToExpanded(false);
        });
      }
      if (window.ghostHUD.onWokenUp) {
        window.ghostHUD.onWokenUp(() => wakeToExpanded(true));
      }
      if (btnPip) btnPip.style.display = 'none'; // Native window already always on top
    }
  }

  /* --------------------------------------------------------------------------
     Config & Preferences
     -------------------------------------------------------------------------- */

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        config = { ...config, ...JSON.parse(saved) };
      }
    } catch (e) {}

    selectModel.value = config.model || 'gemini-2.5-flash';
    toggleMascotIdle.checked = config.mascotIdleEnabled !== false;
    sliderMascotDelay.value = config.mascotDelay || 4;
    valMascotDelay.textContent = `${sliderMascotDelay.value}s`;
    sliderGhostOpacity.value = config.mascotOpacity || 85;
    valGhostOpacity.textContent = `${sliderGhostOpacity.value}%`;

    applyMascotOpacity(config.mascotOpacity);
  }

  async function saveConfig() {
    config.model = selectModel.value;
    config.mascotIdleEnabled = toggleMascotIdle.checked;
    config.mascotDelay = parseInt(sliderMascotDelay.value, 10);
    config.mascotOpacity = parseInt(sliderGhostOpacity.value, 10);

    const enteredKey = inputApiKey.value.trim();
    if (enteredKey) {
      if (isElectron && window.ghostHUD.saveApiKey) {
        // Securely saved to local .env and encrypted store in main process
        await window.ghostHUD.saveApiKey(enteredKey);
        inputApiKey.value = '';
        inputApiKey.placeholder = '•••••••••••••••• (Key safely updated)';
      } else {
        localStorage.setItem('koko_web_key', enteredKey);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    applyMascotOpacity(config.mascotOpacity);
    settingsModal.style.display = 'none';
    resetIdleTimer();
  }

  function applyMascotOpacity(percent) {
    const val = Math.max(0.3, Math.min(1.0, percent / 100));
    document.documentElement.style.setProperty('--mascot-opacity', val.toString());
  }

  /* --------------------------------------------------------------------------
     Mascot Mode & Idle Invisibility Transitions
     -------------------------------------------------------------------------- */

  function setupMascotIdleTimer() {
    const userActions = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'focus'];

    userActions.forEach(act => {
      window.addEventListener(act, () => {
        if (!isMascotMode) resetIdleTimer();
      }, { passive: true });
    });

    window.addEventListener('blur', () => {
      if (!isThinking && settingsModal.style.display !== 'flex') {
        // Accelerate morph to mascot when user clicks back to their lecture video
        resetIdleTimer(1200);
      }
    });

    resetIdleTimer();
  }

  function resetIdleTimer(customDelayMs) {
    if (!config.mascotIdleEnabled) return;
    clearTimeout(idleTimer);

    const delay = customDelayMs !== undefined ? customDelayMs : config.mascotDelay * 1000;
    idleTimer = setTimeout(enterMascotMode, delay);
  }

  function enterMascotMode(notifyElectron = true) {
    if (!config.mascotIdleEnabled || isThinking) return;
    // Don't shrink if settings is open or user is in the middle of typing
    if (settingsModal.style.display === 'flex' || (document.activeElement === promptInput && promptInput.value.length > 0)) {
      return;
    }

    isMascotMode = true;
    container.classList.remove('expanded-view');
    container.classList.add('mascot-view');

    // Pick a playful thought
    const thought = cuteThoughts[Math.floor(Math.random() * cuteThoughts.length)];
    mascotSpeechText.textContent = thought;

    if (isElectron && notifyElectron && window.ghostHUD.setMascotMode) {
      window.ghostHUD.setMascotMode(true);
    }
  }

  function wakeToExpanded(notifyElectron = true) {
    isMascotMode = false;
    container.classList.remove('mascot-view');
    container.classList.add('expanded-view');

    if (isElectron && notifyElectron && window.ghostHUD.setMascotMode) {
      window.ghostHUD.setMascotMode(false);
    }

    resetIdleTimer();
  }

  /* --------------------------------------------------------------------------
     Event Listeners (Clipboard Screenshot Paste & Interactions)
     -------------------------------------------------------------------------- */

  function setupEvents() {
    // Paste screenshot handler (Cmd+V / Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          handleImageBlob(blob);
          if (isMascotMode) wakeToExpanded();
          break;
        }
      }
    });

    // Drag and drop image
    windowEl.addEventListener('dragover', (e) => e.preventDefault());
    windowEl.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length > 0) {
        handleImageBlob(e.dataTransfer.files[0]);
      }
    });

    // File input attach
    btnAttach.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.length > 0) handleImageBlob(e.target.files[0]);
    });

    btnClearThumb.addEventListener('click', clearAttachedImage);

    // Mascot click to wake
    mascotStage.addEventListener('click', () => wakeToExpanded());

    // Morph button in header
    btnToMascot.addEventListener('click', () => enterMascotMode());

    // Settings
    btnSettings.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      clearTimeout(idleTimer);
    });
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.style.display = 'none';
      resetIdleTimer();
    });
    btnSaveSettings.addEventListener('click', saveConfig);

    btnToggleKeyEye.addEventListener('click', () => {
      inputApiKey.type = inputApiKey.type === 'password' ? 'text' : 'password';
    });

    sliderMascotDelay.addEventListener('input', (e) => {
      valMascotDelay.textContent = `${e.target.value}s`;
    });

    sliderGhostOpacity.addEventListener('input', (e) => {
      valGhostOpacity.textContent = `${e.target.value}%`;
      applyMascotOpacity(e.target.value);
    });

    btnClearChat.addEventListener('click', () => {
      if (confirm('Clear chat history with Koko?')) {
        config.messages = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        renderChatHistory();
        settingsModal.style.display = 'none';
      }
    });

    // Pin
    if (btnPin) {
      btnPin.addEventListener('click', () => {
        config.alwaysOnTop = !config.alwaysOnTop;
        btnPin.classList.toggle('active', config.alwaysOnTop);
        if (isElectron && window.ghostHUD.setAlwaysOnTop) {
          window.ghostHUD.setAlwaysOnTop(config.alwaysOnTop);
        }
      });
    }

    // Close / Hide
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (isElectron && window.ghostHUD.hide) {
          window.ghostHUD.hide();
        } else {
          enterMascotMode();
        }
      });
    }

    // PiP for Chrome/Brave
    if (btnPip) {
      if ('documentPictureInPicture' in window) {
        btnPip.addEventListener('click', () => {
          if (window.ghostHUD_PiP) window.ghostHUD_PiP.requestPiP();
        });
      } else {
        btnPip.style.display = 'none';
      }
    }

    // Natural Human Quick-Chips
    quickChips.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-item');
      if (!btn) return;
      const promptText = btn.getAttribute('data-prompt');
      if (currentAttachedImage) {
        submitQuery(promptText);
      } else {
        promptInput.value = promptText;
        promptInput.focus();
      }
    });

    // Form submit
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitQuery();
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitQuery();
      }
    });
  }

  function handleImageBlob(file) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const dataUrl = evt.target.result;
      const base64 = dataUrl.split(',')[1];
      currentAttachedImage = {
        mimeType: file.type,
        base64: base64,
        previewUrl: dataUrl
      };

      previewThumbImg.src = dataUrl;
      attachPreviewBar.style.display = 'flex';
      promptInput.placeholder = 'Ask Koko anything about this slide or equation...';
      promptInput.focus();
    };
    reader.readAsDataURL(file);
  }

  function clearAttachedImage() {
    currentAttachedImage = null;
    attachPreviewBar.style.display = 'none';
    previewThumbImg.src = '';
    fileInput.value = '';
    promptInput.placeholder = 'Ask a doubt or paste screenshot (Cmd+V)...';
  }

  /* --------------------------------------------------------------------------
     Speech Recognition (Whisper Doubt)
     -------------------------------------------------------------------------- */

  function setupSpeech() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      btnMic.style.display = 'none';
      return;
    }

    speechRec = new Speech();
    speechRec.continuous = false;
    speechRec.interimResults = true;
    speechRec.lang = 'en-US';

    let isListening = false;

    speechRec.onstart = () => {
      isListening = true;
      btnMic.classList.add('listening');
    };

    speechRec.onresult = (evt) => {
      const transcript = Array.from(evt.results).map(r => r[0].transcript).join('');
      promptInput.value = transcript;
    };

    speechRec.onerror = () => stopSpeech();
    speechRec.onend = () => {
      stopSpeech();
      if (promptInput.value.trim().length > 0) submitQuery();
    };

    btnMic.addEventListener('click', () => {
      if (isListening) speechRec.stop();
      else speechRec.start();
    });

    function stopSpeech() {
      isListening = false;
      btnMic.classList.remove('listening');
    }
  }

  /* --------------------------------------------------------------------------
     Formatting (KaTeX Math & Markdown)
     -------------------------------------------------------------------------- */

  function setupMarkdownMath() {
    if (window.marked) {
      window.marked.setOptions({ gfm: true, breaks: true });
    }
  }

  function renderFormatted(rawText) {
    if (!rawText) return '';
    let processed = rawText;

    if (window.katex) {
      // Display math: $$...$$
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (m, formula) => {
        try {
          return window.katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
        } catch (e) { return m; }
      });

      // Inline math: $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (m, formula) => {
        try {
          return window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
        } catch (e) { return m; }
      });
    }

    if (window.marked) {
      try { return window.marked.parse(processed); } catch (e) {}
    }

    return escapeHtml(processed);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /* --------------------------------------------------------------------------
     Ask Koko (Secure Gemini API & Chat Engine)
     -------------------------------------------------------------------------- */

  async function submitQuery(overridePrompt) {
    const text = (overridePrompt || promptInput.value).trim();
    const attached = currentAttachedImage;

    if (!text && !attached) return;
    if (isThinking) return;

    promptInput.value = '';
    clearAttachedImage();
    welcomeCard.style.display = 'none';

    // Append user message
    const userMsg = {
      role: 'user',
      text: text || "Hey Koko, take a look at this slide:",
      image: attached ? attached.previewUrl : null,
      timestamp: Date.now()
    };
    appendChatBubble(userMsg);
    config.messages.push(userMsg);

    // Assistant thinking placeholder
    const { itemEl, bubbleEl } = appendChatBubble({ role: 'assistant', text: '' }, true);

    isThinking = true;
    btnSend.disabled = true;

    try {
      if (isElectron && window.ghostHUD.generateGemini) {
        // SECURE DESKTOP IPC: Key is never seen or handled by frontend
        const res = await window.ghostHUD.generateGemini({
          promptText: text,
          attachedImage: attached,
          model: config.model || 'gemini-2.5-flash'
        });

        if (res.success) {
          bubbleEl.innerHTML = renderFormatted(res.reply);
          attachCopyBtn(itemEl, res.reply);
          config.messages.push({ role: 'assistant', text: res.reply, timestamp: Date.now() });
        } else if (res.isDemo || res.error === 'NO_API_KEY') {
          await runSmartDemo(text, attached, bubbleEl, itemEl);
        } else {
          throw new Error(res.error || 'Could not get response');
        }
      } else {
        // Web fallback (direct key or smart demo)
        const webKey = localStorage.getItem('koko_web_key');
        if (webKey) {
          await runDirectWebGemini(webKey, text, attached, bubbleEl, itemEl);
        } else {
          await runSmartDemo(text, attached, bubbleEl, itemEl);
        }
      }
    } catch (err) {
      bubbleEl.innerHTML = `
        <div style="color: var(--accent-rose); font-weight: 600;">
          ⚠️ ${escapeHtml(err.message || 'Something went wrong while connecting to Gemini!')}
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: var(--text-dim);">
          Open Settings (⚙️) to verify your Gemini API key, or check your internet connection.
        </div>
      `;
    } finally {
      isThinking = false;
      btnSend.disabled = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      resetIdleTimer();
    }
  }

  async function runSmartDemo(promptText, attachedImage, bubbleEl, itemEl) {
    await new Promise(r => setTimeout(r, 650));
    let reply = '';
    const q = (promptText || '').toLowerCase();

    if (attachedImage) {
      reply = `**Slide Breakdown** 📸\n\n- **Main Idea:** The core academic concept shown on this whiteboard/slide represents a foundational relationship.\n- **Equation Insight:** $$\\oint \\mathbf{B} \\cdot d\\mathbf{A} = 0$$\n- **Takeaway:** There are no isolated magnetic monopoles; field lines always form closed loops!\n\n> 💡 *To unlock live vision reasoning on any real lecture slide, paste your free Gemini API key in **Settings (⚙️)**!*`;
    } else if (q.includes('math') || q.includes('formula') || q.includes('equation')) {
      reply = `**Here's the math deconstructed** 📐\n\nConsider the fundamental rate equation:\n\n$$\\frac{df}{dx} = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$\n\n- **$f(x+h) - f(x)$:** The change in height (output).\n- **$h$:** The tiny step forward along the horizontal axis.\n- **Intuition:** It's literally just calculating speed: $\\text{Distance} / \\text{Time}$ squeezed into an infinitesimal moment!`;
    } else if (q.includes('takeaway') || q.includes('summary')) {
      reply = `**3 High-Yield Takeaways** ⚡\n\n1. **Core Definition:** The principle explains why the system remains stable under perturbations.\n2. **Common Trap:** Don't confuse instantaneous values with steady-state averages on exams!\n3. **Quick Shortcut:** Remember the proportionality relation: $y \\propto \\frac{1}{x^2}$.`;
    } else {
      reply = `**In Plain English** 💬\n\nThink of this concept like water flowing through pipes of different widths:\n- When the pipe narrows, the water must speed up to get the same amount through ($A_1 v_1 = A_2 v_2$).\n- That's the exact same conservation law the professor is talking about right now!\n\n> 💡 *Koko is ready! You can connect your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey) in **Settings (⚙️)**.*`;
    }

    bubbleEl.innerHTML = renderFormatted(reply);
    attachCopyBtn(itemEl, reply);
    config.messages.push({ role: 'assistant', text: reply, timestamp: Date.now() });
  }

  async function runDirectWebGemini(apiKey, text, attached, bubbleEl, itemEl) {
    const model = config.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const parts = [];
    if (attached && attached.base64) {
      parts.push({ inlineData: { mimeType: attached.mimeType, data: attached.base64 } });
    }
    parts.push({ text: text || "Explain this lecture concept clearly and concisely." });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are Koko, a brilliant, friendly peer study buddy. Explain simply without corporate fluff. Use LaTeX for math ($...$ and $$...$$). Keep answers punchy." }]
        },
        contents: [{ role: 'user', parts }]
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Error ${res.status}`);
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No reply generated.";
    bubbleEl.innerHTML = renderFormatted(reply);
    attachCopyBtn(itemEl, reply);
    config.messages.push({ role: 'assistant', text: reply, timestamp: Date.now() });
  }

  function appendChatBubble(msg, isPending = false) {
    const itemEl = document.createElement('div');
    itemEl.className = `chat-msg-row ${msg.role}`;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'bubble-content';

    if (isPending) {
      bubbleEl.innerHTML = `
        <div class="koko-thinking-dots">
          <span class="koko-dot"></span>
          <span class="koko-dot"></span>
          <span class="koko-dot"></span>
        </div>
      `;
    } else {
      if (msg.image) {
        const img = document.createElement('img');
        img.src = msg.image;
        img.className = 'msg-thumb-preview';
        bubbleEl.appendChild(img);
      }

      const txt = document.createElement('div');
      txt.innerHTML = msg.role === 'assistant' ? renderFormatted(msg.text) : escapeHtml(msg.text);
      bubbleEl.appendChild(txt);
    }

    itemEl.appendChild(bubbleEl);
    chatFeed.appendChild(itemEl);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    if (!isPending && msg.role === 'assistant') {
      attachCopyBtn(itemEl, msg.text);
    }

    return { itemEl, bubbleEl };
  }

  function attachCopyBtn(itemEl, text) {
    const foot = document.createElement('div');
    foot.className = 'msg-foot-bar';

    const btn = document.createElement('button');
    btn.className = 'foot-action-btn';
    btn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy</span>
    `;

    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      btn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => { btn.querySelector('span').textContent = 'Copy'; }, 1500);
    });

    foot.appendChild(btn);
    itemEl.appendChild(foot);
  }

  function renderChatHistory() {
    chatFeed.innerHTML = '';
    if (!config.messages || config.messages.length === 0) {
      chatFeed.appendChild(welcomeCard);
      welcomeCard.style.display = 'flex';
      return;
    }
    welcomeCard.style.display = 'none';
    config.messages.slice(-30).forEach(m => appendChatBubble(m));
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

})();
