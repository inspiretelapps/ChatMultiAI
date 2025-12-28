import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://grok.com/*"],
  run_at: "document_end",
  world: "MAIN"
}

const MESSAGE_SOURCE = "chatmultiai"
const FILL_MESSAGE = "GROK_FILL_PROMPT"
const SENT_MESSAGE = "GROK_PROMPT_SENT"

// Log that the script is loaded
console.log("ChatMultiAI: Grok main-world script loaded at", new Date().toISOString())

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Type for input elements - can be textarea OR contenteditable div
type InputElement = HTMLTextAreaElement | HTMLElement

const isVisible = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
}

const findVisibleTextarea = (): HTMLTextAreaElement | null => {
  const textareas = Array.from(document.querySelectorAll("textarea"))
  for (const textarea of textareas) {
    if (isVisible(textarea)) {
      return textarea
    }
  }
  return null
}

// Find contenteditable elements (Grok might use this instead of textarea)
const findVisibleContentEditable = (): HTMLElement | null => {
  // Try various selectors that Grok might use
  const selectors = [
    'div[contenteditable="true"]',
    '[contenteditable="true"]',
    'div[role="textbox"]',
    '[role="textbox"]',
    'div.ProseMirror',  // ProseMirror editor
    'div[data-placeholder]',  // Common pattern for editable divs
  ]

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    for (const element of elements) {
      if (element instanceof HTMLElement && isVisible(element)) {
        console.log("ChatMultiAI: Found contenteditable with selector:", selector)
        return element
      }
    }
  }
  return null
}

// Find any input element (textarea or contenteditable)
const findVisibleInput = (): InputElement | null => {
  // First try textarea
  const textarea = findVisibleTextarea()
  if (textarea) {
    console.log("ChatMultiAI: Found textarea element")
    return textarea
  }

  // Then try contenteditable
  const contentEditable = findVisibleContentEditable()
  if (contentEditable) {
    console.log("ChatMultiAI: Found contenteditable element")
    return contentEditable
  }

  return null
}

const waitForVisibleInput = (timeout = 15000): Promise<InputElement | null> => {
  return new Promise((resolve) => {
    const existing = findVisibleInput()
    if (existing) return resolve(existing)

    const observer = new MutationObserver(() => {
      const found = findVisibleInput()
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

// Keep old function for backwards compatibility
const waitForVisibleTextarea = (timeout = 15000): Promise<HTMLTextAreaElement | null> => {
  return waitForVisibleInput(timeout) as Promise<HTMLTextAreaElement | null>
}

const setNativeValue = (element: HTMLTextAreaElement, value: string) => {
  // Get the value setter from the element itself (may be overridden by React)
  const elementDescriptor = Object.getOwnPropertyDescriptor(element, "value")
  const elementSetter = elementDescriptor?.set

  // Get the original prototype setter (from HTMLTextAreaElement.prototype)
  const prototype = Object.getPrototypeOf(element)
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value")
  const prototypeSetter = prototypeDescriptor?.set

  // Key insight from React issue #10135:
  // When React has overridden the setter (elementSetter !== prototypeSetter),
  // we must use the PROTOTYPE setter to bypass React's tracking
  if (elementSetter && prototypeSetter && elementSetter !== prototypeSetter) {
    prototypeSetter.call(element, value)
  } else if (prototypeSetter) {
    prototypeSetter.call(element, value)
  } else if (elementSetter) {
    elementSetter.call(element, value)
  } else {
    element.value = value
  }
}

const dispatchInputEvents = (element: HTMLTextAreaElement, value: string) => {
  // Dispatch focus event first
  element.dispatchEvent(new FocusEvent("focus", { bubbles: true }))
  element.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))

  // Dispatch keydown to simulate key press
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a", code: "KeyA" }))

  try {
    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value,
      composed: true
    })
    element.dispatchEvent(beforeInput)
  } catch {
    // Ignore if InputEvent is not supported
  }

  try {
    const input = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value,
      composed: true
    })
    element.dispatchEvent(input)
  } catch {
    element.dispatchEvent(new Event("input", { bubbles: true }))
  }

  // Dispatch keyup after input
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a", code: "KeyA" }))

  element.dispatchEvent(new Event("change", { bubbles: true }))

  // Dispatch compositionend to signal end of text input (some React apps need this)
  try {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: value }))
  } catch {
    // Ignore if not supported
  }
}

const findSubmitButton = (): HTMLButtonElement | null => {
  // Try multiple selectors for the submit button
  const selectors = [
    'button[type="submit"]:not([disabled])',
    'button[aria-label*="send" i]:not([disabled])',
    'button[aria-label*="submit" i]:not([disabled])',
    'button svg[class*="send" i]',
    'form button:not([disabled])',
    // Look for buttons with send icons or specific class names
    'button[class*="send" i]:not([disabled])',
    // Grok-specific: look for button near textarea
    'div[class*="input"] button:not([disabled])',
  ]

  for (const selector of selectors) {
    const button = document.querySelector(selector)
    if (button) {
      // If we found an SVG, get its parent button
      if (button.tagName === 'svg') {
        const parentButton = button.closest('button')
        if (parentButton && !parentButton.disabled) {
          return parentButton as HTMLButtonElement
        }
      } else if (button instanceof HTMLButtonElement) {
        return button
      }
    }
  }

  // Fallback: find any enabled button in the form area
  const textareas = document.querySelectorAll('textarea')
  for (const textarea of textareas) {
    const form = textarea.closest('form')
    if (form) {
      const buttons = form.querySelectorAll('button:not([disabled])')
      for (const btn of buttons) {
        if (btn instanceof HTMLButtonElement) {
          return btn
        }
      }
    }
  }

  return null
}

// Find React's onChange handler by traversing the fiber tree
const findReactOnChange = (element: HTMLElement): ((event: any) => void) | null => {
  // Find React's internal fiber key
  const reactFiberKey = Object.keys(element).find(
    key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  )

  if (!reactFiberKey) {
    console.log("ChatMultiAI: No React fiber found on element")
    return null
  }

  let fiber = (element as any)[reactFiberKey]

  // Traverse up the fiber tree to find a component with onChange
  while (fiber) {
    const props = fiber.memoizedProps || fiber.pendingProps
    if (props?.onChange && typeof props.onChange === 'function') {
      console.log("ChatMultiAI: Found React onChange handler")
      return props.onChange
    }
    fiber = fiber.return
  }

  console.log("ChatMultiAI: No onChange handler found in fiber tree")
  return null
}

// Create a synthetic React-like event
const createSyntheticEvent = (element: HTMLTextAreaElement, value: string) => {
  return {
    target: { value },
    currentTarget: { value },
    preventDefault: () => {},
    stopPropagation: () => {},
    persist: () => {},
    nativeEvent: new Event('change'),
    type: 'change',
    bubbles: true
  }
}

// Simulate clipboard paste - often works better with React apps
const simulateClipboardPaste = async (element: HTMLElement, text: string): Promise<boolean> => {
  try {
    element.focus()
    await sleep(50)

    // Create a paste event with the text data
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData
    })

    element.dispatchEvent(pasteEvent)
    console.log("ChatMultiAI: Dispatched paste event")

    await sleep(50)
    return true
  } catch (e) {
    console.log("ChatMultiAI: Clipboard paste simulation failed:", e)
    return false
  }
}

// Simulate typing character by character (slow but reliable)
const simulateTyping = async (element: HTMLElement, text: string): Promise<boolean> => {
  try {
    element.focus()
    await sleep(50)

    for (const char of text) {
      // Dispatch keydown
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true
      }))

      // Dispatch beforeinput
      element.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true
      }))

      // Dispatch input
      element.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true
      }))

      // Dispatch keyup
      element.dispatchEvent(new KeyboardEvent('keyup', {
        key: char,
        code: `Key${char.toUpperCase()}`,
        bubbles: true
      }))
    }

    console.log("ChatMultiAI: Simulated typing complete")
    return true
  } catch (e) {
    console.log("ChatMultiAI: Simulated typing failed:", e)
    return false
  }
}

// Fill contenteditable element (like Claude's ProseMirror)
const fillContentEditable = async (element: HTMLElement, prompt: string): Promise<boolean> => {
  console.log("ChatMultiAI: Filling contenteditable element")

  // Focus the element first
  element.focus()
  await sleep(50)

  // METHOD 1: Use execCommand (most reliable for contenteditable)
  try {
    document.execCommand('selectAll', false, undefined)
    document.execCommand('insertText', false, prompt)

    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: prompt
    }))

    console.log("ChatMultiAI: execCommand succeeded for contenteditable")

    // Check if it worked
    if (element.textContent === prompt || element.innerText.trim() === prompt) {
      return true
    }
  } catch (e) {
    console.log("ChatMultiAI: execCommand failed for contenteditable:", e)
  }

  // METHOD 2: Try clipboard paste simulation
  await simulateClipboardPaste(element, prompt)
  await sleep(100)
  if (element.textContent?.includes(prompt) || element.innerText?.includes(prompt)) {
    console.log("ChatMultiAI: Clipboard paste worked")
    return true
  }

  // METHOD 3: Direct innerHTML/textContent manipulation
  try {
    // Clear and set content
    element.innerHTML = ''
    const p = document.createElement('p')
    p.textContent = prompt
    element.appendChild(p)

    // Dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: prompt
    }))

    console.log("ChatMultiAI: Direct innerHTML manipulation")
    return true
  } catch (e) {
    console.log("ChatMultiAI: Direct manipulation failed:", e)
  }

  // METHOD 4: Simple textContent
  try {
    element.textContent = prompt
    element.dispatchEvent(new Event('input', { bubbles: true }))
    console.log("ChatMultiAI: Set textContent directly")
    return true
  } catch (e) {
    console.log("ChatMultiAI: textContent failed:", e)
  }

  return false
}

// Fill textarea element
const fillTextarea = async (textarea: HTMLTextAreaElement, prompt: string): Promise<boolean> => {
  console.log("ChatMultiAI: Filling textarea element")

  // Focus and click the textarea
  textarea.focus()
  textarea.click()
  await sleep(50)

  // Store the previous value for _valueTracker trick
  const previousValue = textarea.value

  // PRIMARY METHOD: Native setter + _valueTracker (from React issue #10135)
  setNativeValue(textarea, prompt)

  // Use _valueTracker to trick React into detecting the change
  const tracker = (textarea as unknown as { _valueTracker?: { setValue: (value: string) => void } })
    ._valueTracker
  if (tracker) {
    tracker.setValue(previousValue)
    console.log("ChatMultiAI: Applied _valueTracker trick")
  }

  // Dispatch the input event
  textarea.dispatchEvent(new Event('input', { bubbles: true }))

  // Wait a frame for React to process
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await sleep(50)

  // Check if value was set
  if (textarea.value === prompt) {
    console.log("ChatMultiAI: Primary method worked")
    return true
  }

  console.log("ChatMultiAI: Primary method didn't work, trying fallbacks")

  // FALLBACK 1: Try __reactProps$ onChange
  const reactPropsKey = Object.keys(textarea).find(key => key.startsWith('__reactProps$'))
  if (reactPropsKey) {
    const reactProps = (textarea as any)[reactPropsKey]
    if (reactProps?.onChange) {
      try {
        reactProps.onChange({ target: { value: prompt }, currentTarget: { value: prompt } })
        textarea.value = prompt
        console.log("ChatMultiAI: Called __reactProps$ onChange")
      } catch (e) {
        console.log("ChatMultiAI: __reactProps$ onChange failed:", e)
      }
    }
  }

  // FALLBACK 2: Try React fiber onChange handler
  const onChange = findReactOnChange(textarea)
  if (onChange && textarea.value !== prompt) {
    try {
      const syntheticEvent = createSyntheticEvent(textarea, prompt)
      onChange(syntheticEvent)
      textarea.value = prompt
      console.log("ChatMultiAI: Called React fiber onChange handler")
    } catch (e) {
      console.log("ChatMultiAI: React fiber onChange call failed:", e)
    }
  }

  // FALLBACK 3: Try execCommand
  if (textarea.value !== prompt) {
    try {
      textarea.focus()
      textarea.select()
      document.execCommand('insertText', false, prompt)
      console.log("ChatMultiAI: Used execCommand insertText")
    } catch (e) {
      console.log("ChatMultiAI: execCommand failed:", e)
    }
  }

  // FALLBACK 4: Try clipboard paste simulation
  if (textarea.value !== prompt) {
    await simulateClipboardPaste(textarea, prompt)
    await sleep(100)
  }

  // Final dispatch of all input events
  dispatchInputEvents(textarea, prompt)

  // Set cursor at the end
  try {
    textarea.setSelectionRange(prompt.length, prompt.length)
  } catch {
    // Some textareas may not support selection ranges
  }

  return textarea.value === prompt
}

const fillGrokPrompt = async (prompt: string, autoSend: boolean) => {
  console.log("ChatMultiAI: fillGrokPrompt called with prompt:", prompt.substring(0, 50) + "...", "autoSend:", autoSend)

  const inputElement = await waitForVisibleInput()
  if (!inputElement) {
    console.log("ChatMultiAI: Grok input element not found (tried textarea and contenteditable)")
    return
  }

  const isTextarea = inputElement instanceof HTMLTextAreaElement
  console.log("ChatMultiAI: Found Grok input element, type:", isTextarea ? "textarea" : "contenteditable")

  let success = false

  if (isTextarea) {
    success = await fillTextarea(inputElement, prompt)
  } else {
    success = await fillContentEditable(inputElement, prompt)
  }

  // Wait for React to fully process
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await sleep(150)

  // Verify the value was set
  const currentValue = isTextarea
    ? (inputElement as HTMLTextAreaElement).value
    : inputElement.textContent || inputElement.innerText || ''

  console.log("ChatMultiAI: Input value after fill:", currentValue.substring(0, 50) + "...")
  console.log("ChatMultiAI: Fill succeeded:", success)

  if (!autoSend) {
    console.log("ChatMultiAI: autoSend is false, not clicking submit")
    return
  }

  // Wait a bit more for the button to become enabled
  await sleep(400)

  const submitButton = findSubmitButton()
  if (submitButton) {
    console.log("ChatMultiAI: Found submit button, clicking")
    submitButton.click()
    window.postMessage({ source: MESSAGE_SOURCE, type: SENT_MESSAGE }, "*")
  } else {
    console.log("ChatMultiAI: Grok submit button not available, trying Enter key")

    // Try pressing Enter to submit
    const enterEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13
    })
    inputElement.dispatchEvent(enterEvent)

    await sleep(50)

    inputElement.dispatchEvent(new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13
    }))

    // Also try form submission
    const form = inputElement.closest('form')
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      console.log("ChatMultiAI: Dispatched form submit event")
    }

    window.postMessage({ source: MESSAGE_SOURCE, type: SENT_MESSAGE }, "*")
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  const data = event.data
  if (!data || data.source !== MESSAGE_SOURCE || data.type !== FILL_MESSAGE) return

  const prompt = typeof data.prompt === "string" ? data.prompt : ""
  const autoSend = Boolean(data.autoSend)
  if (!prompt) return

  fillGrokPrompt(prompt, autoSend)
})
