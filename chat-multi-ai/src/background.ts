// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installation reason:', details.reason);
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle opening multiple tabs with the prompt
  if (message.type === "OPEN_AI_PROVIDERS") {
    const { urls, prompt, autoSend } = message
    console.log("Opening AI providers with prompt:", prompt, "autoSend:", autoSend)
    
    // For each URL
    Promise.all(urls.map(async (url: string) => {
      createNewTab(url, prompt, autoSend)
    }))
    
    sendResponse({ success: true })
  }
  
  return true // Keep the message channel open for async response
})

// Helper function to create a new tab
function createNewTab(url: string, prompt: string, autoSend: boolean) {
  chrome.tabs.create({ url }, (tab) => {
    if (tab.id) {
      // Wait for the page to load before sending the message
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, updatedTab) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener)
          // Send message to content script with prompt and autoSend setting
          chrome.tabs.sendMessage(tabId, {
            type: "FILL_PROMPT",
            prompt,
            autoSend
          }).catch((err) => {
            console.error("Failed to send message to content script:", err)
          })
        }
      })
    }
  })
}
