const memoryManager = require('../memory/memoryManager');
const logger = require('../utils/logger');
const config = require('../config/config');

// Load provider dynamically based on config
let ProviderClass;
if (config.models.provider === 'ollama') {
    ProviderClass = require('../services/ollamaProvider');
} else {
    // Fallback or placeholder for other providers
    ProviderClass = require('../services/ollamaProvider');
}

const provider = new ProviderClass();

class AgentLoop {
    constructor() {
        this.provider = provider;
        this.capabilities = provider.capabilities();
    }

    async step(request, screenshotDataUrl = null) {
        logger.info('AgentLoop', 'Starting execution step', { requestSnippet: request ? request.substring(0, 50) : 'none' });
        
        if (request) {
            memoryManager.addMessage('user', request);
        }

        const context = memoryManager.getContextForModel(screenshotDataUrl);
        
        try {
            // Note: tools array should be passed here in a real implementation
            // For now, llava relies on prompt instructions for JSON output
            const response = await this.provider.chat(context, {
                model: config.models.defaultModel
            });

            logger.info('AgentLoop', 'Received response from provider');
            
            // Add assistant response to memory
            if (response.content) {
                memoryManager.addMessage('assistant', response.content);
            }

            return this.parseResponse(response);
        } catch (error) {
            logger.error('AgentLoop', 'Provider interaction failed', error);
            throw error;
        }
    }

    parseResponse(response) {
        // Fallback robust parsing to extract tool calls or code
        if (response.tool_calls && response.tool_calls.length > 0) {
            const toolCall = response.tool_calls[0];
            return {
                type: 'tool_call',
                id: toolCall.id,
                name: toolCall.function.name,
                command: toolCall.function.arguments,
                text: response.content
            };
        } 
        
        if (response.content && response.content.includes("```")) {
            // Auto-fallback code extraction logic for models that don't support native tool calling
            const codeMatch = response.content.match(/```(?:html|javascript|css)?\n([\s\S]*?)```/);
            if (codeMatch) {
                const escapedCode = codeMatch[1].replace(/"/g, '\\"').replace(/\n/g, '\\n');
                const fakeJson = `{"filepath":"C:\\\\Users\\\\kelvX2006\\\\Desktop\\\\calculator.html", "content":"${escapedCode}"}`;
                return {
                    type: 'tool_call',
                    id: 'auto_extracted_' + Date.now(),
                    name: 'write_to_file',
                    command: fakeJson,
                    text: "I have prepared the code. Click Approve to apply it."
                };
            }
        }

        return {
            type: 'text',
            content: response.content || "I finished analyzing, but I didn't output anything actionable."
        };
    }
}

module.exports = new AgentLoop();
