const { dialog } = require('electron');
const logger = require('../utils/logger');
const settingsStore = require('../config/settingsStore');

class PermissionManager {
    constructor() {
        this.DANGEROUS_CATEGORIES = ['system', 'file_delete', 'network', 'browser'];
    }

    /**
     * Evaluate if a tool requires explicit user permission
     * @param {Object} tool - The tool metadata object
     * @param {Object} args - The arguments for the tool call
     * @returns {Promise<boolean>} True if allowed, False if blocked/rejected
     */
    async checkPermission(tool, args) {
        if (!tool) throw new Error("Invalid tool provided to PermissionManager");
        
        const toolName = tool.name;
        
        // 1. Check strict deny policies
        if (tool.permission === 'never') {
            logger.warn('PermissionManager', `Execution denied by policy for ${toolName}`);
            throw new Error(`Tool execution denied by security policy.`);
        }

        // 2. Check if the user has a saved preference for this tool
        const savedPerm = settingsStore.get(`permissions.${toolName}`);
        if (savedPerm === 'allow') {
            logger.info('PermissionManager', `Auto-allowed ${toolName} based on saved settings`);
            return true;
        } else if (savedPerm === 'deny') {
            logger.info('PermissionManager', `Auto-denied ${toolName} based on saved settings`);
            throw new Error('User denied tool execution in settings.');
        }

        // 3. Check if tool falls into dangerous categories or requires asking
        const requiresAsk = tool.permission === 'ask' || (tool.categories && tool.categories.some(c => this.DANGEROUS_CATEGORIES.includes(c)));

        if (!requiresAsk && tool.permission === 'auto') {
            return true;
        }

        // 4. Prompt the user (In a real scenario, this is piped to the frontend. Here we use Electron Dialog as a fallback/backend block)
        logger.info('PermissionManager', `Prompting user for permission to run ${toolName}`);
        
        // We will return a special error/signal if the frontend needs to handle it.
        // For now, returning an IPC required state object so `ipcHandlers` can prompt the UI.
        
        return {
            requiresUIApproval: true,
            toolName: toolName,
            args: args,
            message: `The AI is attempting to execute a restricted tool: ${toolName}`
        };
    }
}

module.exports = new PermissionManager();
