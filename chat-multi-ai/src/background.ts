chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installation reason:", details.reason)
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error))
})

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

async function deliverPrompt(
  tabId: number,
  prompt: string,
  autoSend: boolean
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "FILL_PROMPT",
        prompt,
        autoSend
      })
      return
    } catch (error) {
      console.warn(
        "ChatMultiAI: content script not ready, retrying",
        tabId,
        error
      )
      await sleep(500)
    }
  }
  console.error("ChatMultiAI: gave up delivering prompt to tab", tabId)
}

function createNewTab(url: string, prompt: string, autoSend: boolean) {
  chrome.tabs.create({ url }, (tab) => {
    if (!tab.id) return
    const tabId = tab.id

    const deliver = () => {
      void deliverPrompt(tabId, prompt, autoSend)
    }

    if (tab.status === "complete") {
      deliver()
      return
    }

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return
      chrome.tabs.onUpdated.removeListener(listener)
      deliver()
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_AI_PROVIDERS") {
    const urls: string[] = Array.isArray(message.urls) ? message.urls : []
    const prompt = typeof message.prompt === "string" ? message.prompt : ""
    const autoSend = Boolean(message.autoSend)

    console.log("Opening AI providers with prompt, autoSend:", autoSend)

    for (const url of urls) {
      createNewTab(url, prompt, autoSend)
    }

    sendResponse({ success: true })
  }

  return true
})
