const { EventEmitter } = require('events');
const logger = require('../utils/logger');

class StateMachine extends EventEmitter {
    constructor() {
        super();
        this.states = {
            IDLE: 'Idle',
            LISTENING: 'Listening',
            THINKING: 'Thinking',
            EXECUTING: 'Executing',
            ERROR: 'Error',
            SPEAKING: 'Speaking'
        };
        this.currentState = this.states.IDLE;
        logger.info('StateMachine', 'Initialized');
    }

    setState(newState) {
        const validStates = Object.values(this.states);
        if (!validStates.includes(newState)) {
            logger.error('StateMachine', `Invalid state transition attempted: ${newState}`);
            return;
        }

        if (this.currentState !== newState) {
            const oldState = this.currentState;
            this.currentState = newState;
            this.emit('stateChanged', this.currentState);
            logger.info('StateMachine', `State changed: ${oldState} -> ${this.currentState}`);
        }
    }

    getState() {
        return this.currentState;
    }
}

module.exports = new StateMachine();
