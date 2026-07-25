const memoryManager = require('./src/memory/memoryManager');
const agentLoop = require('./src/core/agentLoop');
const diContainer = require('./src/core/diContainer');
const ProviderFactory = require('./src/services/providers/ProviderFactory');
const pluginManager = require('./src/plugins/PluginManager');

async function test() {
    console.log('Testing tool execution...');
    
    try {
        // Load plugins first
        pluginManager.loadPlugins();
        console.log('✓ Plugins loaded');
        
        const provider = await ProviderFactory.getProvider('Ollama');
        diContainer.register('provider', provider);
        console.log('✓ Provider initialized');
        
        const result = await agentLoop.step('open notepad', false, 0);
        console.log('Response type:', result.type);
        console.log('Response:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

test();
