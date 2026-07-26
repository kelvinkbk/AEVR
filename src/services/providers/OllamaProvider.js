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
            supportsTools: !this.model.toLowerCase().includes('llava')
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

    async chat(messages, tools = [], onStream = null, customOptions = {}) {
        // Check if there are any images in the context
        const hasVision = messages.some(msg => 
            Array.isArray(msg.content) && msg.content.some(c => c.type === 'image_url')
        );
        
        const baseModel = settingsStore.get('ai.model') || 'llama3.2';
        const activeModel = hasVision ? 'llava:latest' : (baseModel.includes('llama3.2-vision') ? 'llama3.2' : baseModel);

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
            return { ...msg };
        });

        const payload = {
            model: activeModel,
            messages: formattedMessages,
            stream: false,
            options: {
                temperature: tools && tools.length > 0 ? 0.1 : 0.5,
                ...customOptions
            }
        };

        if (customOptions.format) {
            payload.format = customOptions.format;
        }

        const activeModelSupportsTools = !activeModel.toLowerCase().includes('llava');
        let formatToolsForPrompt = false;
        
        if (tools && tools.length > 0) {
            if (activeModelSupportsTools) {
                payload.tools = tools;
            } else {
                // If using a vision model that doesn't support tools, don't pass tools at all
                // to avoid confusing the model with complex prompts. It will just describe the image.
                formatToolsForPrompt = false; 
            }
        }

        if (formatToolsForPrompt) {
            const toolDescriptions = tools.map(t => JSON.stringify(t)).join('\n\n');
            const toolPrompt = `\n\n[SYSTEM DIRECTIVE]\nYou have access to the following tools:\n${toolDescriptions}\n\nTo use a tool, output a JSON object like this: {"tool_call": {"name": "tool_name", "arguments": {"arg1": "val"}}}\nOnly return the JSON object when calling a tool.`;
            
            // Append to the last user message to avoid confusing Llama's instruction tuning
            let lastUserMsg = null;
            for (let i = formattedMessages.length - 1; i >= 0; i--) {
                if (formattedMessages[i].role === 'user') {
                    lastUserMsg = formattedMessages[i];
                    break;
                }
            }
            if (lastUserMsg) {
                lastUserMsg.content += toolPrompt;
            } else {
                formattedMessages.push({ role: 'user', content: toolPrompt });
            }
        }
        try {
            if (onStream) {
                payload.stream = true;
                const response = await fetch(`${this.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Ollama API error (${response.status}): ${errText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let fullContent = '';
                let finalData = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(l => l.trim().length > 0);
                    
                    for (const line of lines) {
                        let dataObj;
                        try {
                            if (line.startsWith('data: ')) {
                                if (line.trim() === 'data: [DONE]') continue;
                                dataObj = JSON.parse(line.slice(6));
                            } else {
                                dataObj = JSON.parse(line);
                            }
                        } catch(e) { continue; }

                        if (dataObj.choices && dataObj.choices[0].delta && dataObj.choices[0].delta.content) {
                            const textChunk = dataObj.choices[0].delta.content;
                            fullContent += textChunk;
                            onStream(textChunk);
                        } else if (dataObj.message && dataObj.message.content) {
                            // Ollama native streaming format
                            const textChunk = dataObj.message.content;
                            fullContent += textChunk;
                            onStream(textChunk);
                        }
                        
                        if (dataObj.done || dataObj.choices?.[0]?.finish_reason) {
                            finalData = dataObj;
                        }
                    }
                }
                
                // Construct a mock OpenAI-style response object for the parser
                const mockResponse = {
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: fullContent
                        }
                    }]
                };
                return this.toolCallParser.parse(mockResponse);

            } else {
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
            }
        } catch (error) {
            logger.error('OllamaProvider', 'Chat execution failed', error);
            throw error;
        }
    }
}

module.exports = new OllamaProvider();
