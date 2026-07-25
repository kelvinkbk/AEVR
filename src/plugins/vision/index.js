module.exports = {
    name: 'vision',
    description: 'Provides computer vision and screen reading capabilities.',
    tools: [
        require('./analyzeScreen')
    ],
    init: (eventBus) => {
        eventBus.publish('log', { level: 'INFO', module: 'Plugin:Vision', message: 'Initialized Vision Plugin' });
    }
};
