const registry = require('../tools/registry');

class Executor {
    async executeToolCall(toolCallName, args) {
        console.log(`Executing tool: ${toolCallName}`);
        
        try {
            const result = await registry.invoke(toolCallName, args);
            return result;
        } catch (error) {
            console.error(`Tool execution failed:`, error);
            throw error;
        }
    }
}

module.exports = new Executor();
