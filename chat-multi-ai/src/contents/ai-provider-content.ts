import type { PlasmoCSConfig } from "plasmo"

import {
  fillComposer,
  submitComposer,
  waitForVisible
} from "../lib/composer"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chatgpt.com/*",
    "https://grok.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
    "https://perplexity.ai/*"
  ],
  run_at: "document_end"
}

const GROK_MESSAGE_SOURCE = "chatmultiai"
const GROK_FILL_MESSAGE = "GROK_FILL_PROMPT"
const GROK_FILL_ACK = "GROK_FILL_ACK"
const GROK_SENT_MESSAGE = "GROK_PROMPT_SENT"

const INPUT_SELECTORS: Record<string, string[]> = {
  "chatgpt.com": [
    "#prompt-textarea",
    "div#prompt-textarea[contenteditable='true']",
    "textarea"
  ],
  "claude.ai": [
    "fieldset div.ProseMirror[contenteditable='true']",
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'][enterkeyhint='enter']"
  ],
  "gemini.google.com": [
    "div.ql-editor[contenteditable='true']",
    "rich-textarea [contenteditable='true']",
    "div[aria-label='Enter a prompt here']",
    "div[role='textbox'][contenteditable='true']"
  ],
  "perplexity.ai": [
    "#ask-input",
    "textarea[placeholder*='Ask' i]",
    "[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']"
  ]
}

const isGrokPage = window.location.hostname.includes("grok.com")

function selectorsFor(hostname: string): string[] | null {
  const match = Object.keys(INPUT_SELECTORS).find((domain) =>
    hostname.includes(domain)
  )
  return match ? INPUT_SELECTORS[match] ?? null : null
}

function notifyPromptSent() {
  chrome.runtime.sendMessage({ type: "PROMPT_SENT" }).catch((err) => {
    console.log("Failed to notify background script that prompt was sent:", err)
  })
}

if (isGrokPage) {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== GROK_MESSAGE_SOURCE) return
    if (data.type === GROK_SENT_MESSAGE) notifyPromptSent()
  })
}

async function deliverToGrok(prompt: string, autoSend: boolean) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    let timer = 0

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearInterval(timer)
      window.removeEventListener("message", onMessage)
      resolve(ok)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data
      if (!data || data.source !== GROK_MESSAGE_SOURCE) return
      if (data.type !== GROK_FILL_ACK) return
      finish(true)
    }

    window.addEventListener("message", onMessage)
    window.postMessage(
      {
        source: GROK_MESSAGE_SOURCE,
        type: GROK_FILL_MESSAGE,
        prompt,
        autoSend
      },
      "*"
    )

    let tries = 0
    timer = window.setInterval(() => {
      window.postMessage(
        {
          source: GROK_MESSAGE_SOURCE,
          type: GROK_FILL_MESSAGE,
          prompt,
          autoSend
        },
        "*"
      )
      tries += 1
      if (tries >= 20) finish(false)
    }, 250)
  })
}

async function fillInputBox(prompt: string, autoSend: boolean) {
  const domain = window.location.hostname
  console.log(
    "ChatMultiAI: filling",
    domain,
    "autoSend:",
    autoSend
  )

  try {
    if (domain.includes("grok.com")) {
      const delivered = await deliverToGrok(prompt, autoSend)
      if (!delivered) {
        console.log("ChatMultiAI: Grok main-world script did not acknowledge")
      }
      return
    }

    const selectors = selectorsFor(domain)
    if (!selectors) return

    const input = await waitForVisible(selectors)
    if (!input) {
      console.log("ChatMultiAI: composer not found on", domain)
      return
    }

    await fillComposer(input, prompt)
    console.log("ChatMultiAI: filled composer on", domain)

    if (!autoSend) return

    const sent = await submitComposer(input, prompt)
    if (sent) notifyPromptSent()
  } catch (error) {
    console.error("ChatMultiAI: Error filling input box:", error)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FILL_PROMPT" && message.prompt) {
    console.log(
      "ChatMultiAI: Received FILL_PROMPT",
      "autoSend:",
      message.autoSend
    )
    void fillInputBox(message.prompt, Boolean(message.autoSend))
    sendResponse({ success: true })
  }
  return true
})
