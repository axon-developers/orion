document.addEventListener("DOMContentLoaded", () => {
  const inactiveDiv = document.getElementById("recording-inactive");
  const activeDiv = document.getElementById("recording-active");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const urlInput = document.getElementById("url");

  // Load current state on popup open
  chrome.runtime.sendMessage({ action: "getState" }, (state) => {
    if (state && state.isRecording) {
      showActive();
    } else {
      showInactive();
    }
  });

  startBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url || url === "https://") {
      alert("Please enter a valid URL.");
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const orionTabId = activeTab ? activeTab.id : null;

      chrome.runtime.sendMessage({
        action: "start",
        url: url,
        orionTabId: orionTabId
      }, (response) => {
        showActive();
      });
    });
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "stop" }, (response) => {
      showInactive();
      window.close(); // Close popup
    });
  });

  function showActive() {
    inactiveDiv.style.display = "none";
    activeDiv.style.display = "block";
  }

  function showInactive() {
    inactiveDiv.style.display = "block";
    activeDiv.style.display = "none";
  }
});
