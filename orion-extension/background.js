let recordingState = {
  isRecording: false,
  orionTabId: null,
  targetTabId: null,
  actions: []
};

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "start") {
    recordingState.isRecording = true;
    recordingState.actions = [];
    
    // Save Orion tab ID
    if (sender.tab) {
      recordingState.orionTabId = sender.tab.id;
    } else if (message.orionTabId) {
      recordingState.orionTabId = message.orionTabId;
    }

    // Open target URL in a new tab
    chrome.tabs.create({ url: message.url }, (tab) => {
      recordingState.targetTabId = tab.id;
      recordingState.actions.push({
        type: "navigate",
        url: message.url
      });
      chrome.storage.local.set({ recordingState });
    });
    
    sendResponse({ status: "started" });
  } 
  
  else if (message.action === "record") {
    if (recordingState.isRecording && sender.tab && sender.tab.id === recordingState.targetTabId) {
      recordingState.actions.push(message.step);
      chrome.storage.local.set({ recordingState });
    }
  } 
  
  else if (message.action === "stop") {
    recordingState.isRecording = false;
    chrome.storage.local.set({ recordingState });

    // Download the recorded actions as JSON file
    if (recordingState.actions && recordingState.actions.length > 0) {
      try {
        const jsonString = JSON.stringify(recordingState.actions, null, 2);
        const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(jsonString);
        chrome.downloads.download({
          url: dataUrl,
          filename: "orion-recorded-actions.json",
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.warn("Download failed or bypassed by user:", chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        console.error("Failed to generate download for actions:", err);
      }
    }

    // Send actions back to Orion tab
    if (recordingState.orionTabId) {
      chrome.tabs.sendMessage(recordingState.orionTabId, {
        action: "complete",
        actions: recordingState.actions
      }, (response) => {
        // Safe check for responses
        if (chrome.runtime.lastError) {
          console.warn("Could not send complete event to Orion tab:", chrome.runtime.lastError.message);
        }
      });
    }

    // Close target tab
    if (recordingState.targetTabId) {
      chrome.tabs.remove(recordingState.targetTabId, () => {
        recordingState.targetTabId = null;
      });
    }

    sendResponse({ status: "stopped", actions: recordingState.actions });
  } 
  
  else if (message.action === "getState") {
    sendResponse(recordingState);
  }

  return true;
});
