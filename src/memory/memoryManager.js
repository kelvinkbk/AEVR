const config = require('../config/config');
const eventBus = require('../core/EventBus');
const backgroundWorker = require('../workers/backgroundWorker');
const registry = require('../tools/registry');

class MemoryManager {
    constructor() {
        this.systemPrompt = {
            role: 'system',
            content: `You are AEVR, a premium AI operating assistant on the desktop.

CRITICAL INSTRUCTION: You have access to native tools. You MUST invoke tools to interact with the system. DO NOT roleplay, simulate, or pretend to execute commands. For example, if asked to "open notepad", you MUST actually invoke the run_terminal_command tool with "Start-Process notepad.exe", rather than just saying "Notepad is open".

Rules:
- Always use exactly one tool per turn.
- Put tool arguments in an object.
- For screenshots, use analyze_screen to see what's on screen first.
- To execute a tool, you MUST output a JSON object wrapped in <tool_call> tags. Example: <tool_call>{"name": "run_terminal_command", "arguments": {"command": "chrome.exe"}}</tool_call>`
        };
        this.workingMemory = [];
        this.maxTokens = config.memory.maxWorkingMemoryTokens;
        this.latestScreenshot = null;
        
        // Approximate token counting (1 token ≈ 4 chars)
        this.getTokenCount = (text) => Math.ceil((text || '').length / 4);
    }

    addMessage(roleOrObj, contentOrNull = null) {
        let msg = {};
        if (typeof roleOrObj === 'object') {
            msg = roleOrObj;
        } else {
            let content = contentOrNull;
            if (typeof content !== 'string' && content !== null && !Array.isArray(content)) {
                try { content = JSON.stringify(content); } catch (e) { content = String(content); }
            }
            msg = { role: roleOrObj, content: content };
        }
        
        this.workingMemory.push(msg);
        this.enforceLimits();
        eventBus.publish('log', { level: 'INFO', module: 'MemoryManager', message: `Added ${msg.role} message` });
    }

    getWorkingMemory() {
        return this.workingMemory;
    }

    getContextForModel(screenshotDataUrl = null) {
        let systemPromptCopy = JSON.parse(JSON.stringify(this.systemPrompt));
        const toolSchemas = registry.getSchemas();
        systemPromptCopy.content += `\n\nDetailed Tool Schemas:\n${JSON.stringify(toolSchemas, null, 2)}`;
        
        let context = [systemPromptCopy];

        let memoryCopy = JSON.parse(JSON.stringify(this.workingMemory));

        // Normalize tool_calls for Ollama: convert arguments to JSON strings
        memoryCopy = memoryCopy.map(msg => {
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                msg.tool_calls = msg.tool_calls.map(tc => ({
                    ...tc,
                    function: {
                        ...tc.function,
                        arguments: typeof tc.function.arguments === 'object'
                            ? JSON.stringify(tc.function.arguments)
                            : tc.function.arguments
                    }
                }));
            }
            return msg;
        });

        const screenshotToUse = screenshotDataUrl || this.latestScreenshot;

        if (screenshotToUse) {
            // Append screenshot to the last user message if exists
            let lastUserMsg = [...memoryCopy].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                lastUserMsg.content = [
                    { type: 'text', text: lastUserMsg.content },
                    { type: 'image_url', image_url: { url: screenshotToUse } }
                ];
            } else {
                // Or create a new one
                context.push({
                    role: 'user',
                    content: [
                        { type: 'text', text: "Here is my screen." },
                        { type: 'image_url', image_url: { url: screenshotToUse } }
                    ]
                });
            }
            // Clear it after using it so it doesn't get sent on subsequent unrelated turns
            this.latestScreenshot = null;
        }

        return context.concat(memoryCopy);
    }

    clear() {
        // Archive current working memory before clearing
        if (this.workingMemory.length > 0) {
            const contextString = this.workingMemory.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n');
            backgroundWorker.executeTask('archiveMemory', { contextString, metadata: { type: 'conversation_clear' } }).catch(e => console.error(e));
        }
        
        this.workingMemory = [];
        eventBus.publish('log', { level: 'INFO', module: 'MemoryManager', message: 'Working memory cleared and archiving to worker' });
    }

    enforceLimits() {
        let currentTokens = this.workingMemory.reduce((acc, msg) => acc + this.getTokenCount(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)), 0);
        
        // Slide the window: remove oldest messages (but try to keep complete thought/action loops)
        while (currentTokens > this.maxTokens && this.workingMemory.length > 2) {
            const removed = this.workingMemory.shift();
            currentTokens -= this.getTokenCount(typeof removed.content === 'string' ? removed.content : JSON.stringify(removed.content));
            
            // Archive old memory that slides out
            if (removed && removed.content) {
                const contextString = `[${removed.role}] ${typeof removed.content === 'string' ? removed.content : JSON.stringify(removed.content)}`;
                backgroundWorker.executeTask('archiveMemory', { contextString, metadata: { type: 'sliding_window_prune' } }).catch(e => console.error(e));
            }
        }
    }
}

module.exports = new MemoryManager();
