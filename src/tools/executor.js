const registry = require('./registry');
const logger = require('../utils/logger');

class Executor {
    constructor() {
        this.timeoutMs = 15000; // 15 second default timeout for tools
    }

    async executeToolCall(toolCallName, args) {
        logger.info('Executor', `Executing tool: ${toolCallName}`, { args });
        
        try {
            await registry.checkPermission(toolCallName, args);
            const tool = registry.getTool(toolCallName);
            
            // Execute with timeout
            const result = await Promise.race([
                tool.execute(args),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool execution timed out after ${this.timeoutMs}ms`)), this.timeoutMs))
            ]);

            logger.info('Executor', `Tool execution successful: ${toolCallName}`);
            return result;
        } catch (error) {
            logger.error('Executor', `Tool execution failed: ${toolCallName}`, error);
            throw error;
        }
    }
}

module.exports = new Executor();
