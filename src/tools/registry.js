const fs = require('fs');
const path = require('path');
const { dialog } = require('electron'); // For permission prompts

class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }

    register(tool) {
        if (!tool.name || !tool.permission || !tool.execute) {
            throw new Error(`Invalid tool implementation: ${tool.name}`);
        }
        this.tools.set(tool.name, tool);
    }

    async checkPermission(toolName, args) {
        const tool = this.tools.get(toolName);
        if (!tool) throw new Error(`Tool not found: ${toolName}`);

        if (tool.permission === 'never') {
            throw new Error(`Tool execution denied by security policy.`);
        }

        if (tool.permission === 'ask') {
            const choice = dialog.showMessageBoxSync({
                type: 'warning',
                buttons: ['Approve', 'Deny'],
                defaultId: 1,
                title: 'Security Prompt',
                message: `The AI is attempting to execute a restricted tool: ${toolName}\n\nArguments:\n${JSON.stringify(args, null, 2)}`
            });
            if (choice !== 0) {
                throw new Error('User denied tool execution.');
            }
        }

        return true; // 'auto' falls through to here
    }

    async invoke(toolName, args) {
        await this.checkPermission(toolName, args);
        const tool = this.tools.get(toolName);
        return await tool.execute(args);
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
            const tool = require(path.join(toolsDir, file));
            registry.register(tool);
        }
    });
}

module.exports = registry;
