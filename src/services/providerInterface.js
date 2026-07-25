class ProviderInterface {
    /**
     * Get the provider's capabilities.
     * @returns {Object} { supportsVision: boolean, supportsTools: boolean }
     */
    capabilities() {
        throw new Error("Method 'capabilities()' must be implemented.");
    }

    /**
     * Send a chat request to the provider.
     * @param {Array} messages - Array of message objects {role, content}
     * @param {Object} options - { tools: Array, model: String }
     * @returns {Object} response message { role, content, tool_calls }
     */
    async chat(messages, options = {}) {
        throw new Error("Method 'chat()' must be implemented.");
    }
}

module.exports = ProviderInterface;
