# ChatMultiAI

A Chrome extension that allows you to send the same prompt to multiple AI assistants at once.

ChatMultiAI uses the AI provider websites directly. It opens the selected providers in browser tabs and fills your prompt into each web app, using the accounts and subscriptions you are already signed in with in Chrome. No API keys are needed.

## Features

- Send the same prompt to multiple AI platforms (ChatGPT, Grok, Gemini, Claude, Perplexity) with one click
- Use existing web accounts and paid subscriptions for each provider
- Use Chrome's SidePanel to easily access ChatMultiAI from any webpage
- Select which AI providers to use for each prompt
- Modern UI with shadcn/ui components

## Tech Stack

- React
- TypeScript
- Plasmo (Chrome extension framework)
- Next.js
- shadcn/ui
- TailwindCSS
- pnpm (package manager)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Create a production package
pnpm package
```

## Usage

1. Click the ChatMultiAI icon in your browser to open the SidePanel
2. Select which AI providers you want to use
3. Type your prompt in the text area
4. Click "Send to AI providers" to send your prompt to all selected AI platforms
5. Each selected AI platform will open in a new tab with your prompt

## Supported AI Providers

- ChatGPT
- Claude
- Gemini
- Grok
- Perplexity

## License

MIT
