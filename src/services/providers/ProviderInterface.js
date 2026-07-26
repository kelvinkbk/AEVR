class ProviderInterface {
    constructor() {
        if (new.target === ProviderInterface) {
            throw new TypeError("Cannot construct ProviderInterface instances directly");
        }
        
        // Default capabilities (to be overridden by subclasses)
        this.capabilities = {
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: false,
            supportsReasoning: false,
            supportsAudio: false
        };
    }

    /**
     * @returns {string} The name of the provider (e.g., "Ollama", "OpenAI")
     */
    getName() {
        throw new Error("Method 'getName()' must be implemented.");
    }

    /**
     * @returns {Object} Capabilities object (e.g., { supportsVision: true, supportsTools: true })
     */
    getCapabilities() {
        throw new Error("Method 'getCapabilities()' must be implemented.");
    }

    /**
     * Send a chat completion request to the provider.
     * @param {Array} messages - The conversation history
     * @param {Array} tools - (Optional) Array of available tools
     * @returns {Promise<Object>} The response object containing type (text/tool_call) and content
     */
    async chat(messages, tools = [], onStream = null, options = {}) {
        throw new Error("Method 'chat()' must be implemented.");
    }

    /**
     * Check if the provider is available/online.
     * @returns {Promise<boolean>} True if available
     */
    async isAvailable() {
        throw new Error("Method 'isAvailable()' must be implemented.");
    }
}

module.exports = ProviderInterface;
