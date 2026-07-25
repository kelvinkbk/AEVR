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
        
        // Ensure arrays exist for new metadata
        tool.categories = Array.isArray(tool.categories) ? tool.categories : [];
        tool.metadata = tool.metadata || {};

        this.tools.set(tool.name, tool);
        logger.info('ToolRegistry', `Registered tool: ${tool.name} (Categories: ${tool.categories.join(',')})`);
    }

    // We moved permission checking to PermissionManager, keeping this for backward compatibility temporarily
    async checkPermission(toolName, args) {
        const tool = this.getTool(toolName);
        const permissionManager = require('../security/permissionManager');
        return await permissionManager.checkPermission(tool, args);
    }

    getTool(toolName) {
        return this.tools.get(toolName);
    }

    getSchemas() {
        return Array.from(this.tools.values()).map(t => t.schema);
    }
}

const registry = new ToolRegistry();
module.exports = registry;
