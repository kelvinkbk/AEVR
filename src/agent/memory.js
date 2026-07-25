const fs = require('fs');
const path = require('path');

class MemoryManager {
    constructor(maxWorkingMemoryTokens = 4096) {
        this.workingMemory = [];
        this.maxTokens = maxWorkingMemoryTokens;
        
        // Approximate token counting (1 token ≈ 4 chars)
        this.getTokenCount = (text) => Math.ceil((text || '').length / 4);
    }

    addMessage(role, content) {
        this.workingMemory.push({ role, content });
        this.enforceLimits();
    }

    getWorkingMemory() {
        return this.workingMemory;
    }

    clear() {
        this.workingMemory = [];
    }

    enforceLimits() {
        let currentTokens = this.workingMemory.reduce((acc, msg) => acc + this.getTokenCount(msg.content), 0);
        
        // Simple truncation: if we exceed limit, remove oldest messages (skip system prompt at index 0)
        while (currentTokens > this.maxTokens && this.workingMemory.length > 2) {
            const removed = this.workingMemory.splice(1, 1)[0];
            currentTokens -= this.getTokenCount(removed.content);
        }
    }
}

module.exports = new MemoryManager();
