import type { PlasmoCSConfig } from "plasmo"

// Configuration for the content script
export const config: PlasmoCSConfig = {
  // Match all AI provider URLs - we'll handle specific targeting in the code
  matches: [
    "https://chatgpt.com/*",
    "https://grok.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ],
  // Run as soon as DOM is ready
  run_at: "document_end"
}

const GROK_MESSAGE_SOURCE = "chatmultiai"
const GROK_FILL_MESSAGE = "GROK_FILL_PROMPT"
const GROK_SENT_MESSAGE = "GROK_PROMPT_SENT"

const isGrokPage = window.location.hostname.includes("grok.com")

// Set up message listener for Grok
// The grok-main-world.ts is automatically injected by Plasmo with world: "MAIN"
if (isGrokPage) {
  // Listen for messages from the main-world script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.source !== GROK_MESSAGE_SOURCE) return
    if (data.type === GROK_SENT_MESSAGE) {
      chrome.runtime.sendMessage({ type: "PROMPT_SENT" }).catch((err) => {
        console.log("Failed to notify background script that prompt was sent:", err)
      })
    }
  })

  console.log("ChatMultiAI: Grok content script loaded, main-world script is handled by Plasmo")
}

// Wait for the DOM to be fully loaded and interactive
function waitForPageLoad() {
  return new Promise<void>((resolve) => {
    if (document.readyState === "complete") {
      resolve()
    } else {
      window.addEventListener("load", () => resolve())
    }
  })
}

// Wait for a specific element to appear in the DOM
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector))
    }

    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        observer.disconnect()
        resolve(document.querySelector(selector))
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Set timeout to avoid waiting indefinitely
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

async function waitForEnabledButton(selector: string, timeout = 10000, interval = 100): Promise<HTMLButtonElement | null> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (element instanceof HTMLButtonElement && !element.disabled) {
      return element
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return null
}

// Function to fill the input box with prompt text and send it
async function fillInputBox(prompt: string, autoSend: boolean = false) {
  console.log("ChatMultiAI: Attempting to fill input box with prompt:", prompt, "autoSend:", autoSend)

  try {
    // Different handling based on current domain
    const domain = window.location.hostname
    let promptWasSent = false

    if (domain.includes("chatgpt.com")) {
      // ChatGPT input selector
      const inputBox = await waitForElement("div[id='prompt-textarea']")
      if (inputBox instanceof HTMLElement) {
        // Prefer contenteditable div to keep ChatGPT state in sync.
        if (inputBox.getAttribute("contenteditable") === "true") {
          inputBox.focus()
          await new Promise(resolve => setTimeout(resolve, 50))
          document.execCommand("selectAll", false, undefined)
          document.execCommand("insertText", false, prompt)

          inputBox.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: prompt
          }))

          console.log("ChatMultiAI: Successfully filled ChatGPT input")
        } else {
          // Fallback to find textarea
          const textarea = await waitForElement("div[data-testid='text-input-area'] textarea")
          if (textarea instanceof HTMLTextAreaElement) {
            textarea.focus()
            textarea.value = prompt
            textarea.dispatchEvent(new Event("input", { bubbles: true }))
            console.log("ChatMultiAI: Successfully filled ChatGPT input (textarea)")
          }
        }

        // Auto-submit only if autoSend is true
        if (autoSend) {
          const sendButton = await waitForEnabledButton(
            "button[data-testid='send-button'], button[aria-label='Send'], button[aria-label='Send message'], button[aria-label='Send Message']"
          )
          if (sendButton) {
            sendButton.click()
            console.log("ChatMultiAI: Auto-sent prompt to ChatGPT")
            promptWasSent = true
          } else {
            console.log("ChatMultiAI: Could not find or click send button for ChatGPT")
          }
        }
      }
    } 
    else if (domain.includes("grok.com")) {
      // Grok requires main-world execution to update React state reliably.
      console.log("ChatMultiAI: Posting Grok prompt to main world")
      window.postMessage(
        {
          source: GROK_MESSAGE_SOURCE,
          type: GROK_FILL_MESSAGE,
          prompt,
          autoSend
        },
        "*"
      )
    }
    else if (domain.includes("gemini.google.com")) {
      // Gemini input selector
      const contentEditableDiv = await waitForElement("div.ql-editor[contenteditable='true']")
      if (contentEditableDiv) {
        // Clear existing content
        contentEditableDiv.innerHTML = ""
        
        // Create a paragraph element
        const paragraph = document.createElement("p")
        paragraph.textContent = prompt
        
        // Append the paragraph to the contenteditable div
        contentEditableDiv.appendChild(paragraph)
        
        // Trigger input event
        contentEditableDiv.dispatchEvent(new Event("input", { bubbles: true }))
        console.log("ChatMultiAI: Successfully filled Gemini input")
        
        // Auto-submit only if autoSend is true
        if (autoSend) {
          const sendButton = await waitForElement("button.send-button")
          if (sendButton instanceof HTMLButtonElement) {
            sendButton.click()
            console.log("ChatMultiAI: Auto-sent prompt to Gemini")
            promptWasSent = true
          } else {
            console.log("ChatMultiAI: Could not find or click send button for Gemini")
          }
        }
      }
    }
    else if (domain.includes("claude.ai")) {
      // Claude uses ProseMirror editor
      const contentEditableDiv = await waitForElement("div.ProseMirror[contenteditable='true']") as HTMLElement
      if (contentEditableDiv) {
        // Focus the editor first
        contentEditableDiv.focus()

        // Wait a moment for focus to take effect
        await new Promise(resolve => setTimeout(resolve, 50))

        // Use execCommand to select all and replace - this properly updates ProseMirror state
        // execCommand is the most reliable way to update contenteditable editors
        document.execCommand('selectAll', false, undefined)
        document.execCommand('insertText', false, prompt)

        // Dispatch input event to notify any listeners
        contentEditableDiv.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: prompt
        }))

        console.log("ChatMultiAI: Successfully filled Claude input")

        // Auto-submit only if autoSend is true
        if (autoSend) {
          await new Promise(resolve => setTimeout(resolve, 100))
          const sendButton = await waitForEnabledButton(
            "button[type='button'][aria-label='Send message'], button[type='button'][aria-label='Send Message'], button[type='button'][aria-label='Send'], button[data-testid='send-button']"
          )
          if (sendButton) {
            sendButton.click()
            console.log("ChatMultiAI: Auto-sent prompt to Claude")
            promptWasSent = true
          } else {
            console.log("ChatMultiAI: Could not find or click send button for Claude")
          }
        }
      }
    }


    // Notify background script that the prompt was sent (if autoSend is true)
    if (promptWasSent) {
      chrome.runtime.sendMessage({
        type: "PROMPT_SENT"
      }).catch(err => {
        console.log("Failed to notify background script that prompt was sent:", err)
      })
    }
    
  } catch (error) {
    console.error("ChatMultiAI: Error filling input box:", error)
  }
}

// Main execution
async function main() {
  await waitForPageLoad()
  
  // Listen for messages from the sidepanel via the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FILL_PROMPT" && message.prompt) {
      console.log("ChatMultiAI: Received FILL_PROMPT message:", message.prompt, "autoSend:", message.autoSend)
      fillInputBox(message.prompt, message.autoSend)
      sendResponse({ success: true })
    }
    return true // Keep the message channel open for async response
  })
}

main() 
