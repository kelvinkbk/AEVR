const memoryManager = require('./src/memory/memoryManager');
const agentLoop = require('./src/core/agentLoop');
const diContainer = require('./src/core/diContainer');
const settingsStore = require('./src/config/settingsStore');
const ProviderFactory = require('./src/services/providers/ProviderFactory');

async function test() {
    console.log('Testing agent loop...');
    
    try {
        const provider = await ProviderFactory.getProvider('Ollama');
        diContainer.register('provider', provider);
        console.log('✓ Provider initialized');
        
        const result = await agentLoop.step('hello', false, 0);
        console.log('Response:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
