module.exports = {
    name: 'filesystem',
    description: 'Provides local file system read/write access.',
    tools: [
        require('./readFile'),
        require('./writeFile')
    ],
    init: (eventBus) => {
        eventBus.publish('log', { level: 'INFO', module: 'Plugin:FileSystem', message: 'Initialized FileSystem Plugin' });
    }
};
