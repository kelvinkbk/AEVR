const config = require('../config/config');
const logger = require('../utils/logger');

class MemoryManager {
    constructor() {
        this.systemPrompt = { 
            role: 'system', 
            content: 'You are AEVR, a premium AI operating assistant. You live directly on the desktop. If you need to edit code, output ONLY the improved code enclosed in a ```html markdown block. If you need to run a command, output it as JSON.'
        };
        this.workingMemory = [];
        this.maxTokens = config.memory.maxWorkingMemoryTokens;
        
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
        logger.info('MemoryManager', `Added ${role} message`, { length: content.length });
    }

    getWorkingMemory() {
        return this.workingMemory;
    }

    getContextForModel(screenshotDataUrl = null) {
        let context = [this.systemPrompt];
        
        // Deep copy working memory so we don't accidentally mutate it
        let memoryCopy = JSON.parse(JSON.stringify(this.workingMemory));

        if (screenshotDataUrl) {
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
                        { type: 'image_url', image_url: { url: screenshotDataUrl } }
                    ]
                });
            }
        }

        return context.concat(memoryCopy);
    }

    clear() {
        this.workingMemory = [];
        logger.info('MemoryManager', 'Working memory cleared');
    }

    enforceLimits() {
        let currentTokens = this.workingMemory.reduce((acc, msg) => acc + this.getTokenCount(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)), 0);
        
        // Slide the window: remove oldest messages (but try to keep complete thought/action loops)
        while (currentTokens > this.maxTokens && this.workingMemory.length > 2) {
            const removed = this.workingMemory.shift();
            currentTokens -= this.getTokenCount(typeof removed.content === 'string' ? removed.content : JSON.stringify(removed.content));
        }
    }
}

module.exports = new MemoryManager();
