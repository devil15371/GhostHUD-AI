/**
 * GhostHUD AI — Document Picture-in-Picture Controller
 * Enables a native floating, Always-On-Top window directly inside Chrome and Brave!
 */

(function () {
  'use strict';

  let pipWindow = null;

  async function requestPiP() {
    if (!('documentPictureInPicture' in window)) {
      alert('Document Picture-in-Picture is not supported in this browser. Please use Google Chrome or Brave (v116+).');
      return;
    }

    if (pipWindow) {
      pipWindow.close();
      return;
    }

    try {
      const width = 390;
      const height = 580;

      // Open genuine OS-level floating window via Chrome / Brave
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: width,
        height: height,
        disallowReturnToOpener: false
      });

      // Copy all style sheets and font styles to PiP window
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          if (styleSheet.href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media;
            link.href = styleSheet.href;
            pipWindow.document.head.appendChild(link);
          } else if (styleSheet.cssRules) {
            const style = document.createElement('style');
            Array.from(styleSheet.cssRules).forEach((rule) => {
              style.appendChild(document.createTextNode(rule.cssText));
            });
            pipWindow.document.head.appendChild(style);
          }
        } catch (e) {
          console.warn('Could not copy stylesheet to PiP window', e);
        }
      });

      // Style PiP body
      pipWindow.document.body.className = 'ghosthud-body';
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.overflow = 'hidden';
      pipWindow.document.body.style.background = '#0d1017';

      // Move the HUD container into the PiP window
      const hudContainer = document.getElementById('hud-container');
      const placeholder = document.createElement('div');
      placeholder.id = 'hud-pip-placeholder';
      placeholder.style.display = 'none';
      hudContainer.parentNode.insertBefore(placeholder, hudContainer);

      pipWindow.document.body.appendChild(hudContainer);

      // Listen for when the user closes the PiP window
      pipWindow.addEventListener('pagehide', () => {
        if (placeholder.parentNode) {
          placeholder.parentNode.insertBefore(hudContainer, placeholder);
          placeholder.remove();
        }
        pipWindow = null;
      });

    } catch (err) {
      console.error('Failed to open Picture-in-Picture window:', err);
    }
  }

  window.ghostHUD_PiP = {
    requestPiP: requestPiP,
    isOpen: () => !!pipWindow
  };

})();
