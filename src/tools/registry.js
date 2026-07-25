const fs = require('fs');
const path = require('path');
const { dialog } = require('electron'); 
const logger = require('../utils/logger');

class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(tool) {
        // Validate tool structure
        if (!tool.name || typeof tool.name !== 'string') {
            throw new Error(`Invalid tool: missing or invalid name.`);
        }
        if (!['ask', 'auto', 'never'].includes(tool.permission)) {
            throw new Error(`Invalid tool permission for ${tool.name}. Must be ask, auto, or never.`);
        }
        if (typeof tool.execute !== 'function') {
            throw new Error(`Invalid tool execute function for ${tool.name}.`);
        }
        if (!tool.schema || typeof tool.schema !== 'object') {
            throw new Error(`Invalid tool schema for ${tool.name}.`);
        }

        this.tools.set(tool.name, tool);
        logger.info('ToolRegistry', `Registered tool: ${tool.name}`);
    }

    async checkPermission(toolName, args) {
        const tool = this.tools.get(toolName);
        if (!tool) throw new Error(`Tool not found: ${toolName}`);

        if (tool.permission === 'never') {
            logger.warn('ToolRegistry', `Execution denied by policy for ${toolName}`);
            throw new Error(`Tool execution denied by security policy.`);
        }

        if (tool.permission === 'ask') {
            logger.info('ToolRegistry', `Prompting user for permission to run ${toolName}`);
            const choice = dialog.showMessageBoxSync({
                type: 'warning',
                buttons: ['Approve', 'Deny'],
                defaultId: 1,
                title: 'Security Prompt',
                message: `The AI is attempting to execute a restricted tool: ${toolName}\n\nArguments:\n${JSON.stringify(args, null, 2)}`
            });
            if (choice !== 0) {
                logger.warn('ToolRegistry', `User denied permission for ${toolName}`);
                throw new Error('User denied tool execution.');
            }
            logger.info('ToolRegistry', `User approved permission for ${toolName}`);
        }

        return true; 
    }

    getTool(toolName) {
        return this.tools.get(toolName);
    }

    getSchemas() {
        return Array.from(this.tools.values()).map(t => t.schema);
    }
}

const registry = new ToolRegistry();

// Auto-load tools
const toolsDir = path.join(__dirname, 'implementations');
if (fs.existsSync(toolsDir)) {
    fs.readdirSync(toolsDir).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const tool = require(path.join(toolsDir, file));
                registry.register(tool);
            } catch (e) {
                logger.error('ToolRegistry', `Failed to load tool ${file}`, e);
            }
        }
    });
}

module.exports = registry;
