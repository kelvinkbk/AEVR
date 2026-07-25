module.exports = {
    name: 'system',
    description: 'Provides native system control and terminal execution.',
    tools: [
        require('./runTerminal')
    ],
    init: (eventBus) => {
        eventBus.publish('log', { level: 'INFO', module: 'Plugin:System', message: 'Initialized System Plugin' });
    }
};
