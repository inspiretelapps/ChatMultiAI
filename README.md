# ChatMultiAI

Send the same prompt to multiple AI assistants at once from a Chrome side panel.

ChatMultiAI opens the selected AI web apps in browser tabs and fills your prompt
into each one. It uses the accounts and subscriptions you are already signed in
with in Chrome, so no API keys are needed.

## Install (Manual, from GitHub)

1. Download the latest release ZIP from GitHub Releases: https://github.com/inspiretelapps/ChatMultiAI/releases
2. Unzip the file.
3. Open `chrome://extensions`.
4. Enable **Developer mode** and click **Load unpacked**.
5. Select the unzipped folder.

**Release ZIP name:** The asset is published as `ChatMultiAI-extension.zip` in each GitHub Release.

## Release Checklist (ZIP)

1. Run `scripts/release-zip.sh` to build and package the ZIP.
2. Publish a GitHub Release and upload `ChatMultiAI-extension.zip`.

## Recent Changes

### Fork Updates (inspiretelapps)

- **Added Perplexity support**: Perplexity is now available alongside ChatGPT, Claude, Gemini, and Grok.
- **Fixed Grok integration**: Implemented a main-world script approach to properly handle Grok's React-based input. Uses contenteditable element detection and clipboard paste simulation for reliable prompt filling.
- **Removed model chooser**: Simplified the interface by removing the model selection dropdown - the extension now works with the default model on each AI platform.
- **Updated chat window styling**: Changed the background of the chat window for a cleaner look.
- **Removed DeepSeek support**: Focused on ChatGPT, Claude, Gemini, Grok, and Perplexity.

## Supported AI Providers

- ChatGPT
- Claude
- Gemini
- Grok
- Perplexity
