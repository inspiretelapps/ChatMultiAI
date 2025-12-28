import "./globals.css"
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
// import cssText from "data-text:@/globals.css"
import type { PlasmoCSConfig } from "plasmo"
import { Moon, Sun, Send, Monitor } from "lucide-react"
import logoIcon from "data-base64:~images/logo.png"
import { useTheme } from "next-themes"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

// 导入AI提供商的图标
import chatgptLightIcon from "data-base64:~images/chatgpt-light.png"
import chatgptDarkIcon from "data-base64:~images/chatgpt-dark.png"
import claudeLightIcon from "data-base64:~images/claude-light.png"
import claudeDarkIcon from "data-base64:~images/claude-dark.png"
import geminiLightIcon from "data-base64:~images/gemini-light.png"
import geminiDarkIcon from "data-base64:~images/gemini-dark.png"
import grokLightIcon from "data-base64:~images/grok-light.png"
import grokDarkIcon from "data-base64:~images/grok-dark.png"

export const config: PlasmoCSConfig = {
  css: ["font-src: self;"]
}

// Plasmo CSS handling is not needed when importing CSS directly
// export const getStyle = () => {
//   const style = document.createElement("style")
//   style.textContent = cssText
//   return style
// }

export const getShadowHostId = () => "plasmo-shadow-host"

// 主题类型
type Theme = 'light' | 'dark' | 'system';

// 主题顺序：按照点击循环顺序定义
const themeOrder: Theme[] = ['light', 'dark', 'system'];

interface AIProvider {
  id: string
  name: string
  enabled: boolean
  url: string
  icon: React.ReactNode
}

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme()
  
  // 初始化主题
  useEffect(() => {
    // 这里可以改成从chrome.storage读取
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [setTheme])
  
  // Function to cycle through themes
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }
  
  // Get the appropriate icon for the current theme
  const getThemeIcon = () => {
    switch(theme) {
      case 'light': return <Sun className="h-4 w-4" />
      case 'dark': return <Moon className="h-4 w-4" />
      case 'system': return <Monitor className="h-4 w-4" />
      default: return <Sun className="h-4 w-4" />
    }
  }
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full h-8 w-8"
      onClick={toggleTheme}
      title={`Theme: ${theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'System'}`}
    >
      {getThemeIcon()}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

const ChatMultiAIContent = () => {
  const [prompt, setPrompt] = useState<string>("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialTextareaHeightRef = useRef<number | null>(null)
  
  // Get theme information from next-themes
  const { theme, systemTheme } = useTheme()
  const currentTheme = theme === 'system' ? systemTheme : theme
  const isDark = currentTheme === 'dark'

  // console.log("currentTheme: ", currentTheme)
  
  // Helper function to get icon for provider based on theme, memoized with useCallback
  const getIconForProvider = useCallback((providerId: string) => {
    const textColor = isDark ? "text-white-400" : "text-black-400"
    
    switch(providerId) {
      case "chatgpt":
        return <img src={isDark ? chatgptDarkIcon : chatgptLightIcon} className={`h-6 w-6 ${textColor}`} alt="ChatGPT" />
      case "grok":
        return <img src={isDark ? grokDarkIcon : grokLightIcon} className={`h-6 w-6 ${textColor}`} alt="Grok" />
      case "claude":
        return <img src={isDark ? claudeDarkIcon : claudeLightIcon} className={`h-6 w-6 ${textColor}`} alt="Claude" />
      case "gemini":
        return <img src={isDark ? geminiDarkIcon : geminiLightIcon} className={`h-6 w-6 ${textColor}`} alt="Gemini" />
      default:
        return <img src={isDark ? chatgptDarkIcon : chatgptLightIcon} className={`h-6 w-6 ${textColor}`} alt="AI" />
    }
  }, [isDark]) // Only re-create when isDark changes
  
  // Default providers configuration with useCallback
  const getDefaultProviders = useCallback((): AIProvider[] => [
    {
      id: "chatgpt",
      name: "ChatGPT",
      enabled: true,
      url: "https://chatgpt.com/",
      icon: getIconForProvider("chatgpt")
    },
    {
      id: "grok",
      name: "Grok",
      enabled: true,
      url: "https://grok.com/",
      icon: getIconForProvider("grok")
    },
    {
      id: "gemini",
      name: "Gemini",
      enabled: true,
      url: "https://gemini.google.com/",
      icon: getIconForProvider("gemini")
    },
    {
      id: "claude",
      name: "Claude",
      enabled: true,
      url: "https://claude.ai/",
      icon: getIconForProvider("claude")
    }
  ], [getIconForProvider])
  
  // Initialize providers state with saved data or defaults
  const [providers, setProviders] = useState<AIProvider[]>(() => {
    // Default to an empty array initially, will be populated in useEffect
    return []
  })
  
  // Load providers from localStorage on component mount
  useEffect(() => {
    try {
      const savedProviders = localStorage.getItem('chatmultiai_providers')
      if (savedProviders) {
        const parsed = JSON.parse(savedProviders)
        setProviders(parsed.map((provider: any) => ({
          ...provider,
          icon: getIconForProvider(provider.id)
        })))
      } else {
        setProviders(getDefaultProviders())
      }
    } catch (e) {
      console.error("Failed to load providers:", e)
      setProviders(getDefaultProviders())
    }
  }, [isDark, getIconForProvider]) // Re-run when theme changes to update icons
  
  // Save providers to localStorage whenever they change
  useEffect(() => {
    // Skip saving if providers is empty (initial state)
    if (providers.length === 0) return

    // Serialize providers without the React node icons
    const serializableProviders = providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      enabled: provider.enabled,
      url: provider.url
    }))

    localStorage.setItem('chatmultiai_providers', JSON.stringify(serializableProviders))
  }, [providers])
  
  // Toggle provider enabled state
  const toggleProvider = (id: string) => {
    setProviders(
      providers.map((provider) =>
        provider.id === id
          ? { ...provider, enabled: !provider.enabled }
          : provider
      )
    )
  }
  
  // Add toolbar
  const [autoSend, setAutoSend] = useState(() => {
    // Load auto-send setting from localStorage
    const saved = localStorage.getItem('chatmultiai_auto_send')
    return saved ? JSON.parse(saved) : false
  })

  // Save auto-send setting to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatmultiai_auto_send', JSON.stringify(autoSend))
  }, [autoSend])
  
  // Handle sending prompt to AI providers
  const handleSendPrompt = () => {
    if (!prompt.trim()) return
    
    const enabledProviders = providers.filter((provider) => provider.enabled)
    
    if (enabledProviders.length === 0) return
    
    // Send message to background script with URLs and prompt
    chrome.runtime.sendMessage({
      type: "OPEN_AI_PROVIDERS",
      urls: enabledProviders.map(provider => provider.url),
      prompt: prompt,
      autoSend: autoSend
    }, (response) => {
      if (response && response.success) {
        console.log("Successfully sent prompt to background script")
        // Clear input after sending
        setPrompt("")
      } else {
        console.error("Failed to send prompt to background script")
      }
    })
  }
  
  // Auto-resize textarea when content changes
  // Using useLayoutEffect to run synchronously before browser paint (prevents visual flicker)
  useLayoutEffect(() => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    if (initialTextareaHeightRef.current === null) {
      const measuredHeight = textarea.getBoundingClientRect().height
      initialTextareaHeightRef.current = measuredHeight > 0 ? measuredHeight : 100
    }

    const minHeight = Math.max(100, initialTextareaHeightRef.current)
    const maxHeight = 400

    // Store the current scroll position
    const scrollTop = textarea.scrollTop

    // Temporarily set height to 0 to get accurate scrollHeight measurement
    // Using 0 instead of 'auto' gives us the true content height
    textarea.style.height = '0px'
    const scrollHeight = textarea.scrollHeight

    // Calculate new height: at least minHeight, at most maxHeight
    const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight))
    textarea.style.height = `${newHeight}px`

    // Restore scroll position
    textarea.scrollTop = scrollTop
  }, [prompt])
  
  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center space-x-2">
          <div className="rounded-md p-1">
            <img src={logoIcon} className="h-6 w-6 object-contain" alt="ChatMultiAI logo" />
          </div>
          <h1 className="text-xl font-semibold">ChatMultiAI</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex-grow overflow-auto p-4">
        <div className="space-y-2">
          {providers.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between py-2 px-1">
              <div className="flex items-center gap-3">
                {provider.icon}
                <span className="text-base font-medium">{provider.name}</span>
              </div>
              <Switch
                id={`provider-${provider.id}`}
                checked={provider.enabled}
                onCheckedChange={() => toggleProvider(provider.id)}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 bg-background pt-2 p-4 border-t">
        {/* Add toolbar */}
        <div className="flex items-center justify-end mb-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="auto-send" className="text-sm text-muted-foreground">
                Auto-send
              </label>
              <Switch
                id="auto-send"
                checked={autoSend}
                onCheckedChange={setAutoSend}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </div>

        <Textarea
          ref={textareaRef}
          placeholder="Type your prompt here..."
          className="min-h-[100px] max-h-[400px] resize-none mb-2 focus-visible:ring-primary overflow-y-auto overflow-x-hidden"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // Check if Enter key is pressed without Shift (to allow Shift+Enter for new line)
            if (e.key === 'Enter' && !e.shiftKey) {
              // Don't send if in the middle of composition (e.g., Chinese input)
              if (!e.nativeEvent.isComposing) {
                e.preventDefault() // Prevent new line
                // Only trigger send if prompt is not empty and at least one provider is enabled
                if (prompt.trim() && providers.some((p) => p.enabled)) {
                  handleSendPrompt()
                }
              }
            }
          }}
        />
        <Button 
          className="w-full gap-2 h-10"
          onClick={handleSendPrompt}
          disabled={!prompt.trim() || !providers.some((p) => p.enabled)}
        >
          <Send className="h-4 w-4" />
          Send to AI providers
        </Button>
      </div>
    </div>
  )
}

const ChatMultiAI = () => {
  return (
    <ThemeProvider>
      <ChatMultiAIContent />
    </ThemeProvider>
  )
}

export default ChatMultiAI 
