const logger = require('../../utils/logger');
const ProviderFactory = require('./ProviderFactory');

class DependencyInjector {
    constructor() {
        this.services = new Map();
        logger.info('DependencyInjector', 'Initialized');
    }

    register(name, instance) {
        this.services.set(name, instance);
        logger.info('DependencyInjector', `Registered service: ${name}`);
    }

    get(name) {
        if (!this.services.has(name)) {
            logger.error('DependencyInjector', `Service not found: ${name}`);
            throw new Error(`Service not found: ${name}`);
        }
        return this.services.get(name);
    }
}

// Singleton DI Container
const container = new DependencyInjector();

module.exports = container;
