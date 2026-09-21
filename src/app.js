/**
 * Koko — 3D Floating Anime Study Companion
 * Features:
 * - Idle 3D Figure Floating Mascot (clickable, interactive, unobtrusive on laptops)
 * - Live Transparency Controls (Quick Header Slider + Presets + Settings)
 * - Secure Gemini API Proxy (Hidden in Electron backend, never exposed)
 * - Screenshot Doubt Solving (Cmd+V / Ctrl+V)
 * - KaTeX Math & Markdown Parsing
 */

(function () {
  'use strict';

  // DOM Elements
  const container = document.getElementById('hud-container');
  const mascotStage = document.getElementById('mascot-stage');
  const mascotFigureBtn = document.getElementById('mascot-figure-btn');
  const mascotBubble = document.getElementById('mascot-bubble');
  const mascotSpeechText = document.getElementById('mascot-speech-text');
  const btnMascotWake = document.getElementById('btn-mascot-wake');
  const btnMascotSip = document.getElementById('btn-mascot-sip');

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

  // Quick Transparency Popover
  const btnTransparencyQuick = document.getElementById('btn-transparency-quick');
  const quickOpacityLabel = document.getElementById('quick-opacity-label');
  const transparencyPopover = document.getElementById('transparency-popover');
  const quickOpacitySlider = document.getElementById('quick-opacity-slider');

  // Settings Elements
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKeyEye = document.getElementById('btn-toggle-key-eye');
  const selectModel = document.getElementById('select-model');
  const sliderWindowTransparency = document.getElementById('slider-window-transparency');
  const valWindowTransparency = document.getElementById('val-window-transparency');
  const sliderMascotTransparency = document.getElementById('slider-mascot-transparency');
  const valMascotTransparency = document.getElementById('val-mascot-transparency');
  const toggleMascotIdle = document.getElementById('toggle-mascot-idle');
  const sliderMascotDelay = document.getElementById('slider-mascot-delay');
  const valMascotDelay = document.getElementById('val-mascot-delay');
  const btnClearChat = document.getElementById('btn-clear-chat');

  // State
  const STORAGE_KEY = 'koko_companion_v3';
  let config = {
    model: 'gemini-3.6-flash',
    windowOpacity: 90,     // Window transparency percentage
    mascotOpacity: 95,     // 3D Mascot transparency percentage
    mascotIdleEnabled: true,
    mascotDelay: 4,        // seconds before morphing into 3D mascot
    alwaysOnTop: true,
    messages: []
  };

  let currentAttachedImage = null; // { mimeType, base64, previewUrl }
  let idleTimer = null;
  let isMascotMode = false;
  let isThinking = false;
  let speechRec = null;

  const isElectron = !!(window.ghostHUD && window.ghostHUD.isElectron);

  // Playful 3D companion thoughts when idle
  const companionThoughts = [
    "Watching lecture... 🎧",
    "Got a question? Click me! ✨",
    "Need this formula deconstructed? 📐",
    "Paste a screenshot with Cmd+V! 📸",
    "I'm listening along with you 💻",
    "Analyzing the lecture... 📊"
  ];

  init();

  async function init() {
    loadConfig();
    setupEvents();
    setupMascotIdleTimer();
    setupSpeech();
    setupMarkdownMath();
    renderChatHistory();

    // Check if secure backend has API key configured
    if (isElectron && window.ghostHUD.hasApiKey) {
      const hasKey = await window.ghostHUD.hasApiKey();
      if (hasKey) {
        inputApiKey.placeholder = '•••••••••••••••• (Key safely configured)';
      }
    } else {
      try {
        const res = await fetch('/api/key');
        if (res.ok) {
          const data = await res.json();
          if (data.hasKey) {
            inputApiKey.placeholder = '•••••••••••••••• (Key safely configured in server)';
          }
        }
      } catch (e) {}
    }

    // Electron IPC event bridges
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
      if (btnPip) btnPip.style.display = 'none';
    }
  }

  /* --------------------------------------------------------------------------
     Config & Transparency Engine
     -------------------------------------------------------------------------- */

  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        config = { ...config, ...JSON.parse(saved) };
      }
    } catch (e) {}

    // Auto-migrate any legacy models from previous localStorage runs
    if (!config.model || config.model.includes('2.5') || config.model.includes('1.5')) {
      config.model = 'gemini-3.6-flash';
    }

    // Purge old canned demo messages from chat history
    if (Array.isArray(config.messages)) {
      config.messages = config.messages.filter(m => !m.text || (!m.text.includes('pipes of different widths') && !m.text.includes('conservation principle on this slide')));
    }

    selectModel.value = config.model;
    toggleMascotIdle.checked = config.mascotIdleEnabled !== false;
    sliderMascotDelay.value = config.mascotDelay || 4;
    valMascotDelay.textContent = `${sliderMascotDelay.value}s`;

    const winOpacity = config.windowOpacity !== undefined ? config.windowOpacity : 90;
    sliderWindowTransparency.value = winOpacity;
    valWindowTransparency.textContent = `${winOpacity}%`;
    quickOpacitySlider.value = winOpacity;
    quickOpacityLabel.textContent = `${winOpacity}%`;

    const mascotOp = config.mascotOpacity !== undefined ? config.mascotOpacity : 95;
    sliderMascotTransparency.value = mascotOp;
    valMascotTransparency.textContent = `${mascotOp}%`;

    applyWindowTransparency(winOpacity);
    applyMascotTransparency(mascotOp);
  }

  async function saveConfig() {
    config.model = selectModel.value;
    config.mascotIdleEnabled = toggleMascotIdle.checked;
    config.mascotDelay = parseInt(sliderMascotDelay.value, 10);
    config.windowOpacity = parseInt(sliderWindowTransparency.value, 10);
    config.mascotOpacity = parseInt(sliderMascotTransparency.value, 10);

    const enteredKey = inputApiKey.value.trim();
    if (enteredKey) {
      if (isElectron && window.ghostHUD.saveApiKey) {
        await window.ghostHUD.saveApiKey(enteredKey);
        inputApiKey.value = '';
        inputApiKey.placeholder = '•••••••••••••••• (Key safely updated)';
      } else {
        localStorage.setItem('koko_web_key', enteredKey);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    applyWindowTransparency(config.windowOpacity);
    applyMascotTransparency(config.mascotOpacity);
    settingsModal.style.display = 'none';
    resetIdleTimer();
  }

  function applyWindowTransparency(percent) {
    const dec = Math.max(0.15, Math.min(1.0, percent / 100));
    document.documentElement.style.setProperty('--hud-window-opacity', dec.toString());
    quickOpacityLabel.textContent = `${percent}%`;
    valWindowTransparency.textContent = `${percent}%`;
    quickOpacitySlider.value = percent;
    sliderWindowTransparency.value = percent;

    if (isElectron && window.ghostHUD.setOpacity && !isMascotMode) {
      window.ghostHUD.setOpacity(dec);
    }
  }

  function applyMascotTransparency(percent) {
    const dec = Math.max(0.2, Math.min(1.0, percent / 100));
    document.documentElement.style.setProperty('--mascot-opacity', dec.toString());
    valMascotTransparency.textContent = `${percent}%`;
    sliderMascotTransparency.value = percent;

    if (isElectron && window.ghostHUD.setOpacity && isMascotMode) {
      window.ghostHUD.setOpacity(dec);
    }
  }

  /* --------------------------------------------------------------------------
     Mascot Mode & Idle Transitions
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
        resetIdleTimer(1500); // Curl into 3D mascot faster when returning to lecture video
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
    if (settingsModal.style.display === 'flex' || (document.activeElement === promptInput && promptInput.value.length > 0)) {
      return;
    }

    isMascotMode = true;
    container.classList.remove('expanded-view');
    container.classList.add('mascot-view');
    transparencyPopover.style.display = 'none';

    // Pick playful thought
    const thought = companionThoughts[Math.floor(Math.random() * companionThoughts.length)];
    mascotSpeechText.textContent = thought;

    applyMascotTransparency(config.mascotOpacity);

    // Schedule periodic cozy coffee sips while studying together
    startCoffeeSchedule();

    const videoIdle = document.getElementById('video-mascot-idle');
    if (videoIdle && typeof videoIdle.play === 'function' && videoIdle.paused) {
      videoIdle.play().catch(() => {});
    }

    if (isElectron && notifyElectron && window.ghostHUD.setMascotMode) {
      window.ghostHUD.setMascotMode(true);
    }
  }

  /* --------------------------------------------------------------------------
     Living Companion Interactions: Coffee Sipping & Eye Blinks
     -------------------------------------------------------------------------- */
  let isSipping = false;
  let sipTimer = null;
  let coffeeInterval = null;
  let blinkInterval = null;

  function wakeToExpanded(notifyElectron = true) {
    isMascotMode = false;
    container.classList.remove('mascot-view');
    container.classList.add('expanded-view');

    // Pause videos when collapsed into study HUD to save 100% CPU/GPU
    const videoIdle = document.getElementById('video-mascot-idle');
    const videoSip = document.getElementById('video-mascot-sip');
    if (videoIdle && typeof videoIdle.pause === 'function') videoIdle.pause();
    if (videoSip && typeof videoSip.pause === 'function') videoSip.pause();

    // Reset sipping state
    stopCoffeeSchedule();
    if (isSipping) {
      mascotStage.classList.remove('is-sipping');
      isSipping = false;
    }

    applyWindowTransparency(config.windowOpacity);

    if (isElectron && notifyElectron && window.ghostHUD.setMascotMode) {
      window.ghostHUD.setMascotMode(false);
    }

    resetIdleTimer();
  }

  const coffeeThoughts = [
    "Warm coffee! ☕",
    "Cozy coffee sip... ☕",
    "Mmm, delicious! ☕",
    "Fresh roast ☕",
    "Studying with you ☕"
  ];

  function drinkCoffee() {
    if (isSipping || !isMascotMode) return;
    isSipping = true;
    mascotStage.classList.add('is-sipping');

    const videoSip = document.getElementById('video-mascot-sip');
    if (videoSip) {
      videoSip.currentTime = 0;
      videoSip.play().catch(() => {});
    }

    const coffeeThought = coffeeThoughts[Math.floor(Math.random() * coffeeThoughts.length)];
    mascotSpeechText.textContent = coffeeThought;

    if (sipTimer) clearTimeout(sipTimer);
    sipTimer = setTimeout(() => {
      mascotStage.classList.remove('is-sipping');
      isSipping = false;
      const videoIdle = document.getElementById('video-mascot-idle');
      if (videoIdle && videoIdle.paused) {
        videoIdle.play().catch(() => {});
      }
      setTimeout(() => {
        if (isMascotMode && !mascotFigureBtn.matches(':hover')) {
          mascotSpeechText.textContent = "Watching lecture with you... ☕";
        }
      }, 1400);
    }, 3160);
  }

  function triggerBlink(doubleBlink = false) {
    if (isSipping) return;
    mascotFigureBtn.classList.add('blink-active');
    setTimeout(() => {
      mascotFigureBtn.classList.remove('blink-active');
      if (doubleBlink) {
        setTimeout(() => {
          if (isSipping) return;
          mascotFigureBtn.classList.add('blink-active');
          setTimeout(() => {
            mascotFigureBtn.classList.remove('blink-active');
          }, 140);
        }, 120);
      }
    }, 160);
  }

  function startCoffeeSchedule() {
    if (coffeeInterval) clearInterval(coffeeInterval);
    coffeeInterval = setInterval(() => {
      if (isMascotMode && !isThinking && !mascotStage.matches(':hover') && !isSipping) {
        drinkCoffee();
      }
    }, 18000);

    // Natural blink interval: random 2.5–6s cadence
    if (blinkInterval) clearInterval(blinkInterval);
    function scheduleBlink() {
      const delay = 2500 + Math.random() * 3500;
      blinkInterval = setTimeout(() => {
        if (isMascotMode && !isSipping) {
          triggerBlink(Math.random() < 0.25);
        }
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
  }

  function stopCoffeeSchedule() {
    if (coffeeInterval) {
      clearInterval(coffeeInterval);
      coffeeInterval = null;
    }
    if (blinkInterval) {
      clearTimeout(blinkInterval);
      blinkInterval = null;
    }
  }

  /* --------------------------------------------------------------------------
     Event Listeners & Click Handlers
     -------------------------------------------------------------------------- */

  function setupEvents() {
    // Mascot Drag & Click Handlers (Allows moving the girl freely or clicking to open)
    let isDraggingMascot = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let hasMovedMascot = false;

    mascotFigureBtn.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      isDraggingMascot = true;
      hasMovedMascot = false;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingMascot || !isMascotMode) return;
      const deltaX = e.screenX - dragStartX;
      const deltaY = e.screenY - dragStartY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasMovedMascot = true;
        dragStartX = e.screenX;
        dragStartY = e.screenY;
        if (isElectron && window.ghostHUD.moveWindow) {
          window.ghostHUD.moveWindow(deltaX, deltaY);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isDraggingMascot = false;
    });

    mascotFigureBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasMovedMascot) {
        hasMovedMascot = false;
        return;
      }
      wakeToExpanded();
    });

    mascotBubble.addEventListener('click', (e) => {
      e.stopPropagation();
      wakeToExpanded();
    });

    btnMascotWake.addEventListener('click', (e) => {
      e.stopPropagation();
      wakeToExpanded();
    });

    if (btnMascotSip) {
      btnMascotSip.addEventListener('click', (e) => {
        e.stopPropagation();
        drinkCoffee();
      });
    }

    mascotStage.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      wakeToExpanded();
    });

    // Dynamic Hover Reactions that bring Koko to life!
    mascotFigureBtn.addEventListener('mouseenter', () => {
      if (!isSipping) {
        mascotSpeechText.textContent = "I'm ready! What's confusing you? ✏️";
      }
    });

    mascotFigureBtn.addEventListener('mouseleave', () => {
      if (!isSipping) {
        mascotSpeechText.textContent = "Watching lecture with you... ☕";
      }
    });

    // Morph button in header
    btnToMascot.addEventListener('click', () => enterMascotMode());

    // Quick Transparency Popover Toggle
    btnTransparencyQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = transparencyPopover.style.display === 'flex';
      transparencyPopover.style.display = isVisible ? 'none' : 'flex';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.transparency-control-wrap')) {
        transparencyPopover.style.display = 'none';
      }
    });

    // Quick Opacity Slider
    quickOpacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      config.windowOpacity = val;
      applyWindowTransparency(val);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    });

    // Quick Opacity Presets
    transparencyPopover.addEventListener('click', (e) => {
      const pill = e.target.closest('.preset-pill');
      if (!pill) return;
      const op = parseInt(pill.getAttribute('data-opacity'), 10);
      config.windowOpacity = op;
      applyWindowTransparency(op);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    });

    // Settings Modal Sliders
    sliderWindowTransparency.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      applyWindowTransparency(val);
    });

    sliderMascotTransparency.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      applyMascotTransparency(val);
    });

    sliderMascotDelay.addEventListener('input', (e) => {
      valMascotDelay.textContent = `${e.target.value}s`;
    });

    // Settings Modal Open/Close
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

    btnClearChat.addEventListener('click', () => {
      if (confirm('Clear chat history with Koko?')) {
        config.messages = [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        renderChatHistory();
        settingsModal.style.display = 'none';
      }
    });

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
      try {
        let html = window.marked.parse(processed);
        // Sanitize: strip dangerous tags (script, iframe, object, embed, form)
        html = html.replace(/<(script|iframe|object|embed|form)(\s|>)[\s\S]*?<\/\1>/gi, '');
        html = html.replace(/<(script|iframe|object|embed|form)(\s[^>]*)?\/>/gi, '');
        // Strip event handler attributes (onerror, onclick, onload, etc.)
        html = html.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s+on\w+\s*=\s*\S+/gi, '');
        return html;
      } catch (e) {}
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
      text: text || "Hey Koko, check out this slide:",
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
          model: config.model || 'gemini-3.6-flash'
        });

        if (res.success) {
          bubbleEl.innerHTML = renderFormatted(res.reply);
          attachCopyBtn(itemEl, res.reply);
          config.messages.push({ role: 'assistant', text: res.reply, timestamp: Date.now() });
        } else {
          throw new Error(res.error || 'Could not get response from Gemini');
        }
      } else {
        // Web fallback (try local server API proxy first)
        let proxyHandled = false;
        try {
          const proxyRes = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              promptText: text,
              attachedImage: attached,
              model: config.model || 'gemini-3.6-flash'
            })
          });
          if (proxyRes.ok) {
            const data = await proxyRes.json();
            if (data.success) {
              proxyHandled = true;
              bubbleEl.innerHTML = renderFormatted(data.reply);
              attachCopyBtn(itemEl, data.reply);
              config.messages.push({ role: 'assistant', text: data.reply, timestamp: Date.now() });
            } else if (!data.isDemo && data.error !== 'NO_API_KEY') {
              throw new Error(data.error || 'Gemini error');
            }
          }
        } catch (err) {
          if (err.message && !err.message.includes('Failed to fetch')) {
            throw err;
          }
        }

        if (!proxyHandled) {
          const webKey = localStorage.getItem('koko_web_key');
          if (webKey) {
            await runDirectWebGemini(webKey, text, attached, bubbleEl, itemEl);
          } else {
            throw new Error('No API key configured. Open Settings (⚙️) to save your key.');
          }
        }
      }
    } catch (err) {
      bubbleEl.innerHTML = `
        <div style="color: var(--accent-rose); font-weight: 600;">
          ⚠️ ${escapeHtml(err.message || 'Something went wrong while connecting to Gemini!')}
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: var(--text-dim);">
          Open Settings (⚙️) to check your Gemini API key or network connection.
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
      reply = `**Slide Analysis** 📸\n\n- **Core Principle:** The equations represent energy conservation across boundaries.\n- **Equation:** $$\\oint \\mathbf{B} \\cdot d\\mathbf{A} = 0$$\n- **Key Takeaway:** Magnetic field lines are continuous closed loops with zero divergence.\n\n> 💡 *Paste your free Gemini API key in **Settings (⚙️)** to ask live doubts on any lecture!*`;
    } else if (q.includes('math') || q.includes('formula') || q.includes('equation')) {
      reply = `**Math Deconstruction** 📐\n\nHere is the underlying physical relationship:\n\n$$E = \\hbar \\omega = h \\nu$$\n\n- **$\\hbar$:** Reduced Planck constant ($h / 2\\pi$).\n- **$\\omega$:** Angular frequency of oscillation.\n- **Intuition:** Energy comes in discrete packets (quanta)—the higher the frequency, the more energetic each packet!`;
    } else if (q.includes('takeaway') || q.includes('summary')) {
      reply = `**3 High-Yield Exam Takeaways** ⚡\n\n1. **Core Concept:** Primary mechanism governing the system's equilibrium.\n2. **Frequent Trap:** Watch out for negative signs in differential equations.\n3. **Quick Formula:** Remember the inverse-square relation: $F \\propto \\frac{1}{r^2}$.`;
    } else {
      reply = `**In Plain English** 💬\n\nThink of this concept like water flowing through pipes of different widths:\n- When the pipe narrows, the velocity increases ($A_1 v_1 = A_2 v_2$).\n- The professor is using the exact same conservation principle on this slide!\n\n> 💡 *To solve any live lecture problem, add your 100% free Gemini API key in **Settings (⚙️)**.*`;
    }

    bubbleEl.innerHTML = renderFormatted(reply);
    attachCopyBtn(itemEl, reply);
    config.messages.push({ role: 'assistant', text: reply, timestamp: Date.now() });
  }

  async function runDirectWebGemini(apiKey, text, attached, bubbleEl, itemEl) {
    const model = config.model || 'gemini-3.6-flash';
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
          parts: [{ text: "You are Koko, a brilliant 3D study companion. Explain simply without corporate fluff. Use LaTeX for math ($...$ and $$...$$). Keep answers punchy." }]
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
    // Cap stored messages at 50, strip base64 images from older entries to prevent localStorage overflow
    if (config.messages.length > 50) {
      config.messages = config.messages.slice(-50);
    }
    config.messages.forEach((m, i) => {
      if (i < config.messages.length - 10 && m.image && m.image.startsWith('data:')) {
        m.image = null; // Free base64 from old messages
      }
    });
    config.messages.slice(-30).forEach(m => appendChatBubble(m));
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

})();
