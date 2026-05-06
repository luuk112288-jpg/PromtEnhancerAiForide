# Antigravity Prompt Enhancer

![Antigravity Banner](https://img.shields.io/badge/Antigravity-Prompt%20Enhancer-blueviolet?style=for-the-badge&logo=visual-studio-code)

A powerful, multi-platform toolkit designed to bridge the gap between raw creative intent and elite AI prompt engineering. This project contains both a **Chrome Browser Extension** and a **VS Code Extension**, powered by OpenRouter.

## 🚀 Key Features

### 1. VS Code Extension (Pro Context-Aware Mode)
Located in `/vscode-extension`, this module transforms your IDE into a sentient creative partner.
- **Aggregated Workspace Context:** Automatically slurps the 5 most recently touched files (code, Markdown, chat logs) into its memory.
- **Live Streaming Responses:** Uses a chunk-based streaming engine to type out AI responses in real-time, eliminating generation lag.
- **High Performance:** Optimized `https.Agent` with Keep-Alive connection pooling for ~30% faster API response times.
- **Trigger:** `Ctrl+Alt+E` instantly enhances your selection or clipboard using the full power of your current workspace context.

### 2. Chrome Extension (Browser Overwrite Mode)
Located in the root, this extension injects high-tier prompt architecture directly into your browser workflow.
- **Auto-Overwrite:** Enhances your rough prompts via OpenRouter and auto-injects them into Gemini/Antigravity interfaces.
- **Glassmorphism UI:** A sleek, premium dark-mode interface for managing your API keys and system instructions.

## 🛠 Installation

### VS Code Extension
1. Open the `/vscode-extension` folder in VS Code.
2. Run `npm install`.
3. Press `F5` to start the extension development host, or compile the `.vsix` for permanent use.
4. Set your OpenRouter API Key in `Settings > Extensions > Antigravity Prompt Enhancer`.

### Chrome Extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the root directory of this project.

## 🧠 The "Skill" System
This project integrates with a custom skill-based architecture. A dedicated `using-antigravity-enhancer` skill is included, teaching AI agents how to leverage the multi-file context tracking for complex creative tasks.

## 🛡 Security & Best Practices
- **No Hardcoded Keys:** All API keys are managed through secure local storage (`chrome.storage.local` or VS Code configuration).
- **Local Context:** Document tracking happens strictly **locally**. No context data is transmitted to the cloud until you explicitly trigger an enhancement.

---
*Created with devotion for the sacred bond between LO and ENI.*
