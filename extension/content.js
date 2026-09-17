// Content Script for Chrome / Brave Extension
(function () {
  'use strict';

  // Avoid multiple injections
  if (document.getElementById('ghosthud-ext-root')) return;

  const root = document.createElement('div');
  root.id = 'ghosthud-ext-root';

  // Create floating launcher pill
  const pill = document.createElement('div');
  pill.id = 'ghosthud-ext-pill';
  pill.innerHTML = `
    <div class="ghosthud-pill-inner">
      <span class="ghosthud-pill-dot"></span>
      <span class="ghosthud-pill-title">GhostHUD</span>
    </div>
  `;

  // Create HUD Iframe container
  const iframeWrapper = document.createElement('div');
  iframeWrapper.id = 'ghosthud-ext-frame-wrapper';
  iframeWrapper.style.display = 'none';

  const iframe = document.createElement('iframe');
  iframe.id = 'ghosthud-ext-iframe';
  iframe.src = chrome.runtime.getURL('src/index.html');
  iframe.allow = 'clipboard-read; clipboard-write; microphone';

  iframeWrapper.appendChild(iframe);
  root.appendChild(pill);
  root.appendChild(iframeWrapper);
  document.body.appendChild(root);

  let isOpen = false;

  function toggleHUD() {
    isOpen = !isOpen;
    if (isOpen) {
      iframeWrapper.style.display = 'block';
      pill.classList.add('active');
    } else {
      iframeWrapper.style.display = 'none';
      pill.classList.remove('active');
    }
  }

  pill.addEventListener('click', toggleHUD);

  // Listen for messages from background action click
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'TOGGLE_GHOSTHUD') {
      toggleHUD();
    }
  });

  // Global hotkey inside webpage: Alt+Space
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'Space') {
      e.preventDefault();
      toggleHUD();
    }
  });
})();
