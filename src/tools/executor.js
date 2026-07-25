const registry = require('./registry');
const logger = require('../utils/logger');
const permissionManager = require('../security/permissionManager');

class Executor {
    constructor() {
        this.timeoutMs = 15000; // 15 second default timeout for tools
        this.history = [];
    }

    async executeToolCall(toolCallName, args, retries = 1) {
        logger.info('Executor', `Executing tool: ${toolCallName}`, { args, retries });
        
        const tool = registry.getTool(toolCallName);
        if (!tool) throw new Error(`Tool not found: ${toolCallName}`);

        try {
            // Permission Firewall
            const permCheck = await permissionManager.checkPermission(tool, args);
            
            // If the permission manager returns an object demanding UI approval
            if (permCheck && permCheck.requiresUIApproval) {
                return permCheck; // Return the signal to the agentLoop/IPCHandler to pause and prompt
            }

            // Execute with timeout
            const result = await Promise.race([
                tool.execute(args),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool execution timed out after ${this.timeoutMs}ms`)), this.timeoutMs))
            ]);

            this._recordHistory(toolCallName, args, result, 'success');
            logger.info('Executor', `Tool execution successful: ${toolCallName}`);
            return result;
        } catch (error) {
            this._recordHistory(toolCallName, args, error.message, 'error');
            logger.error('Executor', `Tool execution failed: ${toolCallName}`, error);
            
            if (retries > 0) {
                logger.info('Executor', `Retrying tool execution: ${toolCallName}`);
                return this.executeToolCall(toolCallName, args, retries - 1);
            }
            
            throw error;
        }
    }

    _recordHistory(name, args, result, status) {
        this.history.push({
            timestamp: new Date().toISOString(),
            name,
            args,
            result: typeof result === 'string' ? result.substring(0, 500) : result,
            status
        });
        // Keep last 50
        if (this.history.length > 50) this.history.shift();
    }
}

module.exports = new Executor();
