const registry = require('./registry');
const eventBus = require('../core/EventBus');
const permissionManager = require('../security/permissionManager');

class Executor {
    constructor() {
        this.timeoutMs = 15000; // 15 second default timeout for tools
        this.history = [];
    }

    async executeToolCall(toolCallName, args, retries = 1) {
        const startTime = Date.now();
        eventBus.publish('log', { level: 'INFO', module: 'Executor', message: `Executing tool: ${toolCallName}`, meta: { args, retries } });

        const tool = registry.getTool(toolCallName);
        if (!tool) throw new Error(`Tool not found: ${toolCallName}`);

        try {
            // Permission Firewall - check if requires approval
            const permCheck = await permissionManager.checkPermission(tool, args);

            // If permission check returns an object with requiresUIApproval flag
            if (permCheck && typeof permCheck === 'object' && permCheck.requiresUIApproval) {
                eventBus.publish('log', { level: 'INFO', module: 'Executor', message: `Tool requires UI approval: ${toolCallName}` });
                return permCheck; // Return the signal to the agentLoop/IPCHandler to pause and prompt
            }

            // If permission check returns true, we're good to go
            if (permCheck === true) {
                // Execute with timeout
                const result = await Promise.race([
                    tool.execute(args),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool execution timed out after ${this.timeoutMs}ms`)), this.timeoutMs))
                ]);

                this._recordHistory(toolCallName, args, result, 'success');
                eventBus.publish('log', { level: 'INFO', module: 'Executor', message: `Tool execution successful: ${toolCallName}` });
                eventBus.publish('metrics:tool_latency', Date.now() - startTime);
                return result;
            }

            // If we get here, permission was denied
            throw new Error(`Permission denied for tool: ${toolCallName}`);
        } catch (error) {
            this._recordHistory(toolCallName, args, error.message, 'error');
            eventBus.publish('log', { level: 'ERROR', module: 'Executor', message: `Tool execution failed: ${toolCallName}`, meta: { errorMsg: error.message } });

            if (retries > 0 && !error.message.includes('Permission denied')) {
                eventBus.publish('log', { level: 'INFO', module: 'Executor', message: `Retrying tool execution: ${toolCallName}` });
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
