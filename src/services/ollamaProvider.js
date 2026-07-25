const ProviderInterface = require('./providerInterface');
const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class OllamaProvider extends ProviderInterface {
    constructor() {
        super();
        this.client = new OpenAI({
            baseURL: config.ollama.baseUrl,
            apiKey: 'ollama' // Required by SDK but unused by Ollama
        });
        
        logger.info('OllamaProvider', 'Initialized with baseUrl', { url: config.ollama.baseUrl });
    }

    capabilities() {
        return {
            supportsVision: true,
            supportsTools: true,
        };
    }

    async chat(messages, options = {}) {
        const model = options.model || config.models.defaultModel;
        
        try {
            logger.info('OllamaProvider', `Sending chat request to model: ${model}`, { messageCount: messages.length });
            
            const req = {
                model: model,
                messages: messages,
                max_tokens: 1024
            };

            if (options.tools && options.tools.length > 0) {
                req.tools = options.tools;
            }

            const response = await this.client.chat.completions.create(req);
            
            logger.info('OllamaProvider', 'Received response successfully');
            return response.choices[0].message;

        } catch (error) {
            logger.error('OllamaProvider', 'Chat completion failed', error);
            
            // Normalize errors for upstream
            if (error.code === 'ECONNREFUSED') {
                throw new Error("Cannot connect to Ollama. Is it running?");
            }
            if (error.message.includes('model not found')) {
                throw new Error(`Model '${model}' not found in Ollama.`);
            }
            
            throw error;
        }
    }
}

module.exports = OllamaProvider;
