require('dotenv').config();

const config = {
    // Application settings
    app: {
        env: process.env.NODE_ENV || 'development',
    },

    // Model Provider Settings
    models: {
        provider: process.env.AI_PROVIDER || 'ollama',
        defaultModel: process.env.DEFAULT_MODEL || 'llama2',
        visionModel: process.env.VISION_MODEL || 'llava',
    },

    // Ollama Specific
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    },

    // Memory settings
    memory: {
        maxWorkingMemoryTokens: parseInt(process.env.MAX_MEMORY_TOKENS, 10) || 4096,
        sessionMemoryEnabled: process.env.ENABLE_SESSION_MEMORY !== 'false',
    }
};

module.exports = config;
