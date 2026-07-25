const logger = require('../../utils/logger');
const ProviderInterface = require('./ProviderInterface');
// Will import specific providers below as we build them
const OllamaProvider = require('./OllamaProvider');

class ProviderFactory {
    constructor() {
        this.providers = new Map();

        // Register default providers
        this.register(OllamaProvider);
        // More will be registered here (OpenAIProvider, etc)
    }

    register(provider) {
        if (!(provider instanceof ProviderInterface)) {
            throw new Error('Provider must implement ProviderInterface');
        }
        this.providers.set(provider.getName(), provider);
        logger.info('ProviderFactory', `Registered provider: ${provider.getName()}`);
    }

    async getProvider(name) {
        if (this.providers.has(name)) {
            return this.providers.get(name);
        }
        logger.warn('ProviderFactory', `Provider '${name}' not found, attempting auto-detect...`);
        return await this.autoDetectProvider();
    }

    async autoDetectProvider() {
        logger.info('ProviderFactory', 'Starting auto-detection of local providers...');
        
        // Check Ollama
        if (this.providers.has('Ollama')) {
            const ollama = this.providers.get('Ollama');
            if (await ollama.isAvailable()) {
                logger.info('ProviderFactory', 'Auto-detected Ollama as available.');
                return ollama;
            }
        }
        
        // Throw if none available
        throw new Error('No AI providers are currently available. Please check your settings or start a local provider.');
    }
}

module.exports = new ProviderFactory();
