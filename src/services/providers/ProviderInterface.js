class ProviderInterface {
    constructor() {
        if (this.constructor === ProviderInterface) {
            throw new Error("Abstract classes can't be instantiated.");
        }
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
    async chat(messages, tools = []) {
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
