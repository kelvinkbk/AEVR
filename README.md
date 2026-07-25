# AEVR Desktop Assistant

AEVR is a premium AI desktop assistant powered by Electron and Local LLMs (Ollama, OpenAI, Anthropic). It features a floating glassmorphism UI, autonomous multi-step reasoning, memory retention, and native computer control capabilities.

## 🚀 Features

- **Autonomous Agent Loop:** Powered by a ReAct-style loop and a dedicated Planner module, AEVR can break down complex tasks into subtasks and execute them automatically.
- **Dynamic Glassmorphism UI:** A stunning, animated "Dynamic Island" style UI that floats on your desktop, complete with interactive state visualizers.
- **Provider Agnostic:** Uses Dependency Injection to seamlessly switch between local AI providers (like Ollama) or cloud providers.
- **Security Firewall:** All sensitive computer control tools (like terminal execution or file writing) run through a strict `PermissionManager` that pauses execution and demands explicit human approval via the UI.
- **Multi-Tiered Memory:** Utilizes a fast sliding-window working memory for active tasks and a lightweight semantic retrieval engine for archiving long-term contexts.
- **Persistent Settings:** Automatically saves your preferences, window position, and tool permissions to `~/.aevr/settings.json`.

## 🛠️ Architecture (V2)

The AEVR backend is built using strictly modular SOLID principles:
- **`src/core/`**: Contains the `agentLoop`, `planner`, `stateMachine`, and `diContainer` (Dependency Injector).
- **`src/services/providers/`**: The provider abstraction layer (`ProviderFactory`, `ProviderInterface`).
- **`src/memory/`**: Contains `memoryManager` (sliding window) and `SemanticRetrieval` (long-term archive).
- **`src/security/`**: Houses the `PermissionManager` firewall.
- **`src/tools/`**: Contains the tool `registry` and the timeout-wrapped `executor`.

## 📦 Installation & Setup

1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Settings:**
   AEVR will automatically create a configuration folder at `~/.aevr/` upon first boot. You can manually edit `~/.aevr/settings.json` to configure your AI provider:
   ```json
   {
       "ai": {
           "provider": "Ollama",
           "model": "llama3.1",
           "baseUrl": "http://localhost:11434/v1"
       }
   }
   ```
4. **Start the app:**
   ```bash
   npm start
   ```

## 🔐 Security & Tools

AEVR is capable of powerful native operations. To keep your system safe, any tool marked as `ask` (such as `run_terminal_command`) will trigger a **Security Authorization** prompt in the UI.

You can explicitly 'Approve' or 'Reject' the action. If rejected, the Agent Loop is instantly notified and will attempt to route around the blockage autonomously.

## 📄 Logs

Structured JSON logs with automatic date rotation are saved to `~/.aevr/logs/` for easy debugging.

---
*Built by the AEVR Team.*
