// 1. Handshake with the Orion page
if (document.getElementById("root") || window.location.host.includes("localhost:5173") || window.location.host.includes("localhost:8080")) {
  const script = document.createElement("script");
  script.textContent = "window.__orion_extension_present__ = true;";
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // Listen to Orion's start recording trigger
  window.addEventListener("OrionStartRecording", (e) => {
    chrome.runtime.sendMessage({
      action: "start",
      url: e.detail.url
    });
  });

  // Listen to Orion's stop recording trigger
  window.addEventListener("OrionStopRecording", () => {
    chrome.runtime.sendMessage({ action: "stop" });
  });

  // Listen for recording complete message from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "complete") {
      window.dispatchEvent(new CustomEvent("OrionRecordingComplete", {
        detail: { actions: message.actions }
      }));
      sendResponse({ status: "dispatched" });
    }
    return true;
  });
}

// 2. Interaction capturing on the target website
chrome.runtime.sendMessage({ action: "getState" }, (state) => {
  if (state && state.isRecording) {
    setupInteractionListeners();
  }
});

function setupInteractionListeners() {
  document.addEventListener("click", (e) => {
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return;
    }
    
    const selector = getCssSelector(e.target);
    if (selector) {
      chrome.runtime.sendMessage({
        action: "record",
        step: {
          type: "click",
          selector: selector
        }
      });
    }
  }, true);

  document.addEventListener("change", (e) => {
    const tagName = e.target.tagName.toLowerCase();
    if (tagName !== "input" && tagName !== "textarea" && tagName !== "select") {
      return;
    }

    const selector = getCssSelector(e.target);
    let value = e.target.value;

    if (selector) {
      if (e.target.type === "password") {
        value = "{{secrets.INPUT_PASSWORD}}";
      }

      chrome.runtime.sendMessage({
        action: "record",
        step: {
          type: "fill",
          selector: selector,
          value: value
        }
      });
    }
  }, true);
}

function getCssSelector(el) {
  if (!(el instanceof Element)) return "";
  
  if (el.id) {
    const idSelector = `#${el.id}`;
    try {
      if (document.querySelectorAll(idSelector).length === 1) {
        return idSelector;
      }
    } catch (e) {}
  }
  
  const qaAttributes = ["data-testid", "data-qa", "data-cy"];
  for (const attr of qaAttributes) {
    if (el.hasAttribute(attr)) {
      const qaSelector = `[${attr}="${el.getAttribute(attr)}"]`;
      try {
        if (document.querySelectorAll(qaSelector).length === 1) {
          return qaSelector;
        }
      } catch (e) {}
    }
  }

  if (el.getAttribute("name")) {
    const nameSelector = `${el.tagName.toLowerCase()}[name="${el.getAttribute("name")}"]`;
    try {
      if (document.querySelectorAll(nameSelector).length === 1) {
        return nameSelector;
      }
    } catch (e) {}
  }

  if (el.className && typeof el.className === "string") {
    const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(":") && !c.includes("/"));
    if (classes.length > 0) {
      const classSelector = `${el.tagName.toLowerCase()}.${classes.join(".")}`;
      try {
        if (document.querySelectorAll(classSelector).length === 1) {
          return classSelector;
        }
      } catch (e) {}
    }
  }

  const path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    let sibling = el.previousElementSibling;
    let index = 1;
    while (sibling) {
      if (sibling.nodeName === el.nodeName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }
    
    let hasSiblings = false;
    let nextSibling = el.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.nodeName === el.nodeName) {
        hasSiblings = true;
        break;
      }
      nextSibling = nextSibling.nextElementSibling;
    }

    if (index > 1 || hasSiblings) {
      selector += `:nth-of-type(${index})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}
