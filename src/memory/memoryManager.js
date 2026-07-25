const config = require('../config/config');
const eventBus = require('../core/EventBus');
const backgroundWorker = require('../workers/backgroundWorker');

class MemoryManager {
    constructor() {
        this.systemPrompt = { 
            role: 'system', 
            content: 'You are AEVR, a premium AI operating assistant. You live directly on the desktop. You have access to specialized tools to run commands, edit files, and analyze the screen. You MUST use these provided tools natively to take action instead of writing out JSON blocks or code directly in your text response.'
        };
        this.workingMemory = [];
        this.maxTokens = config.memory.maxWorkingMemoryTokens;
        this.latestScreenshot = null;
        
        // Approximate token counting (1 token ≈ 4 chars)
        this.getTokenCount = (text) => Math.ceil((text || '').length / 4);
    }

    addMessage(role, content) {
        if (typeof content !== 'string') {
            try {
                content = JSON.stringify(content);
            } catch (e) {
                content = String(content);
            }
        }
        
        this.workingMemory.push({ role, content });
        this.enforceLimits();
        eventBus.publish('log', { level: 'INFO', module: 'MemoryManager', message: `Added ${role} message`, meta: { length: content.length } });
    }

    getWorkingMemory() {
        return this.workingMemory;
    }

    getContextForModel(screenshotDataUrl = null) {
        let context = [this.systemPrompt];
        
        let memoryCopy = JSON.parse(JSON.stringify(this.workingMemory));

        const screenshotToUse = screenshotDataUrl || this.latestScreenshot;

        if (screenshotToUse) {
            // Append screenshot to the last user message if exists
            let lastUserMsg = [...memoryCopy].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                lastUserMsg.content = [
                    { type: 'text', text: lastUserMsg.content },
                    { type: 'image_url', image_url: { url: screenshotDataUrl } }
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
