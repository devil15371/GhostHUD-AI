// Background Service Worker for Chrome / Brave Extension
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_GHOSTHUD' });
  } catch (err) {
    // If content script is not yet injected
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});
