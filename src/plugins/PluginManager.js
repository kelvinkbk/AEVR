const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const eventBus = require('../core/EventBus');
const registry = require('../tools/registry');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname);
    }

    async loadPlugins() {
        logger.info('PluginManager', 'Discovering plugins...');
        
        if (!fs.existsSync(this.pluginsDir)) return;

        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const pluginPath = path.join(this.pluginsDir, entry.name, 'index.js');
                if (fs.existsSync(pluginPath)) {
                    try {
                        const plugin = require(pluginPath);
                        this.registerPlugin(entry.name, plugin);
                    } catch (e) {
                        logger.error('PluginManager', `Failed to load plugin: ${entry.name}`, e);
                    }
                }
            }
        }
        
        eventBus.publish('plugins:loaded', this.plugins.size);
    }

    registerPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            logger.warn('PluginManager', `Plugin ${name} is already registered.`);
            return;
        }

        // Initialize plugin if it has an init hook
        if (typeof plugin.init === 'function') {
            try {
                plugin.init(eventBus);
            } catch (e) {
                logger.error('PluginManager', `Plugin ${name} failed during initialization`, e);
            }
        }

        // Register exposed tools
        if (Array.isArray(plugin.tools)) {
            plugin.tools.forEach(tool => {
                registry.register(tool);
            });
        }

        this.plugins.set(name, plugin);
        logger.info('PluginManager', `Successfully loaded plugin: ${name}`);
    }

    getPlugin(name) {
        return this.plugins.get(name);
    }
}

module.exports = new PluginManager();
