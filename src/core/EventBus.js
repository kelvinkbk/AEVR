const { EventEmitter } = require('events');

class EventBus extends EventEmitter {
    constructor() {
        super();
        // Increase max listeners for heavy plugin architecture
        this.setMaxListeners(50);
    }

    publish(event, data) {
        this.emit(event, data);
    }

    subscribe(event, listener) {
        this.on(event, listener);
    }

    unsubscribe(event, listener) {
        this.off(event, listener);
    }
}

// Singleton Event Bus for the entire application
module.exports = new EventBus();
