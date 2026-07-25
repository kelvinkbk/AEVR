const ProviderInterface = require('./ProviderInterface');
const settingsStore = require('../../config/settingsStore');
const logger = require('../../utils/logger');
const OpenSourceToolCallParser = require('./OpenSourceToolCallParser');

class OllamaProvider extends ProviderInterface {
    constructor() {
        super();
        this.baseUrl = settingsStore.get('ai.baseUrl') || 'http://localhost:11434/v1';
        const configuredModel = settingsStore.get('ai.model') || 'llama3.2';
        this.model = configuredModel.includes('llama3.2-vision') ? 'llava:latest' : configuredModel;
        this.toolCallParser = new OpenSourceToolCallParser();
        
        this.capabilities = {
            supportsVision: true, // Assuming llama3.2-vision or similar
            supportsTools: true,
            supportsStreaming: false, // Planned for future
            supportsReasoning: false,
            supportsAudio: false
        };
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
        // Clone messages to avoid mutating the original history
        const formattedMessages = messages.map(msg => {
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
                return {
                    ...msg,
                    tool_calls: msg.tool_calls.map(tc => ({
                        ...tc,
                        function: {
                            ...tc.function,
                            arguments: typeof tc.function.arguments === 'object' ? JSON.stringify(tc.function.arguments) : tc.function.arguments
                        }
                    }))
                };
            }
            return msg;
        });

        const payload = {
            model: this.model,
            messages: formattedMessages,
            stream: false,
            options: {
                temperature: tools && tools.length > 0 ? 0.1 : 0.5
            }
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
            return this.toolCallParser.parse(data);
        } catch (error) {
            logger.error('OllamaProvider', 'Chat execution failed', error);
            throw error;
        }
    }
}

module.exports = new OllamaProvider();
