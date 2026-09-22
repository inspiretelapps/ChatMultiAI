const SEND_SELECTORS = [
  "[data-testid='send-button']",
  "[data-testid='composer-send-button']",
  "[data-test-id='gemini-chat-send-button']",
  "button[aria-label='Send prompt']",
  "button[aria-label='Send message']",
  "button[aria-label='Send Message']",
  "button[aria-label='Send']",
  "button[aria-label='Submit']",
  "button.send-button",
  "button[aria-label*='send' i]",
  "button[aria-label*='submit' i]",
  "[role='button'][aria-label*='send' i]",
  "[role='button'][aria-label*='submit' i]",
  "button[type='submit']"
]

const REJECT_CONTROL =
  /stop|voice|microphone|dictat|attach|upload|\bfile\b|image|photo|gallery|tools|model picker|share/i

type QuillEditor = {
  setText: (value: string) => void
}

type QuillContainer = HTMLElement & {
  __quill?: QuillEditor
  quill?: QuillEditor
}

type TextControl = HTMLInputElement | HTMLTextAreaElement

type TrackedTextControl = TextControl & {
  _valueTracker?: { setValue: (value: string) => void }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0
  )
}

function isControlDisabled(element: HTMLElement): boolean {
  if (element instanceof HTMLButtonElement && element.disabled) return true
  if (element.getAttribute("aria-disabled") === "true") return true
  if (element.hasAttribute("disabled")) return true
  if (element.getAttribute("data-disabled") === "true") return true
  return window.getComputedStyle(element).pointerEvents === "none"
}

function asControl(element: HTMLElement): HTMLElement {
  return element.closest("button, [role='button']") ?? element
}

function isSendCandidate(element: HTMLElement): boolean {
  const aria = element.getAttribute("aria-label") ?? ""
  const testId =
    element.getAttribute("data-testid") ??
    element.getAttribute("data-test-id") ??
    ""
  const blob = `${aria} ${testId} ${element.className}`
  if (!REJECT_CONTROL.test(blob)) return true
  return /send|submit/i.test(aria) || /send|submit/i.test(testId)
}

function eachElement(
  root: ParentNode,
  visit: (element: HTMLElement) => void
) {
  const collect = (scope: ParentNode) => {
    scope.querySelectorAll("*").forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      visit(node)
      if (node.shadowRoot) collect(node.shadowRoot)
    })
  }
  collect(root)
}

function nodesIn(root: ParentNode, selector: string): HTMLElement[] {
  const result: HTMLElement[] = []
  eachElement(root, (element) => {
    if (element.matches(selector)) result.push(asControl(element))
  })
  return result
}

function sendControlsIn(
  root: ParentNode
): Array<{ control: HTMLElement; rank: number }> {
  const result: Array<{ control: HTMLElement; rank: number }> = []
  const seen = new Set<HTMLElement>()
  eachElement(root, (element) => {
    const rank = SEND_SELECTORS.findIndex((selector) => element.matches(selector))
    if (rank < 0) return
    const control = asControl(element)
    if (seen.has(control)) return
    seen.add(control)
    result.push({ control, rank })
  })
  return result
}

export function queryVisible(selectors: string[]): HTMLElement | null {
  const found: HTMLElement[] = []
  for (const selector of selectors) {
    nodesIn(document, selector).forEach((element) => {
      if (isVisible(element)) found.push(element)
    })
    if (found.length > 0) break
  }
  if (found.length === 0) return null
  found.sort(
    (a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
  )
  return found[0] ?? null
}

export async function waitForVisible(
  selectors: string[],
  timeout = 15000
): Promise<HTMLElement | null> {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const found = queryVisible(selectors)
    if (found) return found
    await sleep(200)
  }
  return null
}

function textIsPresent(element: HTMLElement, text: string): boolean {
  const sample = text.trim().slice(0, 24)
  if (!sample) return false
  const current =
    element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement
      ? element.value
      : element.innerText || element.textContent || ""
  return current.includes(sample)
}

function selectContents(element: HTMLElement) {
  element.focus()
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}

function fillTextControl(element: TextControl, text: string) {
  const prototype = Object.getPrototypeOf(element) as object
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  const previous = element.value
  if (setter) {
    setter.call(element, text)
  } else {
    element.value = text
  }
  const tracker = (element as TrackedTextControl)._valueTracker
  tracker?.setValue(previous)
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    })
  )
}

export async function fillComposer(
  element: HTMLElement,
  text: string
): Promise<void> {
  element.focus()
  await sleep(40)

  if (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && element.type !== "submit")
  ) {
    fillTextControl(element, text)
    return
  }

  const quillRoot = element.closest(".ql-container") as QuillContainer | null
  const quill = quillRoot?.__quill ?? quillRoot?.quill
  if (quill) {
    quill.setText(text)
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    )
    return
  }

  selectContents(element)
  document.execCommand("selectAll", false)
  const inserted = document.execCommand("insertText", false, text)
  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    })
  )

  if (inserted && textIsPresent(element, text)) return

  element.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    })
  )

  if (textIsPresent(element, text)) return

  const data = new DataTransfer()
  data.setData("text/plain", text)
  element.dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: data
    })
  )
}

export function findSendButton(input: HTMLElement): HTMLElement | null {
  const scopes: ParentNode[] = []
  let current: HTMLElement | null = input
  for (let depth = 0; depth < 12 && current; depth += 1) {
    scopes.push(current)
    current = current.parentElement
  }
  const rootNode = input.getRootNode()
  if (rootNode instanceof ShadowRoot) scopes.push(rootNode)
  scopes.push(document)

  const seen = new Set<HTMLElement>()
  let best: HTMLElement | null = null
  let bestRank = Number.POSITIVE_INFINITY

  for (const scope of scopes) {
    for (const candidate of sendControlsIn(scope)) {
      const element = candidate.control
      if (seen.has(element)) continue
      seen.add(element)
      if (
        !isVisible(element) ||
        isControlDisabled(element) ||
        !isSendCandidate(element)
      ) {
        continue
      }
      if (candidate.rank < bestRank) {
        best = element
        bestRank = candidate.rank
      }
    }
    if (best) return best
  }
  return best
}

function pressEnter(input: HTMLElement) {
  input.focus()
  for (const type of ["keydown", "keypress", "keyup"] as const) {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: "Enter",
      code: "Enter"
    })
    Object.defineProperty(event, "keyCode", { get: () => 13 })
    Object.defineProperty(event, "which", { get: () => 13 })
    input.dispatchEvent(event)
  }
}

function activateControl(element: HTMLElement) {
  const pointerInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0
  }
  const mouseInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0
  }
  element.dispatchEvent(new PointerEvent("pointerdown", pointerInit))
  element.dispatchEvent(new MouseEvent("mousedown", mouseInit))
  element.dispatchEvent(new PointerEvent("pointerup", pointerInit))
  element.dispatchEvent(new MouseEvent("mouseup", mouseInit))
  element.click()
}

export async function submitComposer(
  input: HTMLElement,
  prompt: string,
  timeout = 8000
): Promise<boolean> {
  const started = Date.now()
  let nudged = false

  while (Date.now() - started < timeout) {
    const button = findSendButton(input)
    if (button) {
      activateControl(button)
      console.log(
        "ChatMultiAI: clicked send control",
        button.getAttribute("aria-label") ||
          button.getAttribute("data-testid") ||
          button.className
      )
      await sleep(700)
      if (textIsPresent(input, prompt)) {
        console.log("ChatMultiAI: composer still has the prompt, pressing Enter")
        pressEnter(input)
      }
      return true
    }

    if (!nudged && Date.now() - started > 1500 && !textIsPresent(input, prompt)) {
      nudged = true
      console.log("ChatMultiAI: composer still empty, filling again")
      await fillComposer(input, prompt)
    }

    await sleep(200)
  }

  console.log("ChatMultiAI: send control stayed disabled, pressing Enter")
  pressEnter(input)
  return true
}
