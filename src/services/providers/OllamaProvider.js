const ProviderInterface = require('./ProviderInterface');
const config = require('../../config/config');
const logger = require('../../utils/logger');

class OllamaProvider extends ProviderInterface {
    constructor() {
        super();
        this.baseUrl = config.llm.baseUrl || 'http://localhost:11434/v1';
        this.model = config.llm.model || 'llama3.1';
    }

    getName() {
        return 'Ollama';
    }

    getCapabilities() {
        // We assume llava supports vision, others don't for Ollama locally usually
        const supportsVision = this.model.toLowerCase().includes('llava');
        return {
            supportsVision,
            supportsTools: true
        };
    }

    async isAvailable() {
        try {
            // Check Ollama status endpoint
            const url = new URL(this.baseUrl);
            const statusUrl = `${url.protocol}//${url.host}/api/tags`;
            
            const response = await fetch(statusUrl, { method: 'GET' });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async chat(messages, tools = []) {
        const payload = {
            model: this.model,
            messages: messages,
            temperature: 0.1
        };

        if (tools && tools.length > 0) {
            payload.tools = tools;
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            const choice = data.choices[0];
            const msg = choice.message;

            if (msg.tool_calls && msg.tool_calls.length > 0) {
                const toolCall = msg.tool_calls[0];
                return {
                    type: 'tool_call',
                    id: toolCall.id,
                    name: toolCall.function.name,
                    command: toolCall.function.arguments,
                    text: msg.content // Sometimes models provide thought text before a tool call
                };
            }

            return {
                type: 'text',
                content: msg.content
            };
        } catch (error) {
            logger.error('OllamaProvider', 'Chat execution failed', error);
            throw error;
        }
    }
}

module.exports = OllamaProvider;
