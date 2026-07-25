const eventBus = require('./EventBus');
const logger = require('../utils/logger');

class StateMachine {
    constructor() {
        this.states = {
            IDLE: 'Idle',
            LISTENING: 'Listening',
            THINKING: 'Thinking',
            PLANNING: 'Planning',
            EXECUTING: 'Executing',
            WAITING_APPROVAL: 'Waiting Approval',
            SPEAKING: 'Speaking',
            COMPLETED: 'Completed',
            ERROR: 'Error',
            INTERRUPTED: 'Interrupted'
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
            eventBus.publish('state:change', this.currentState);
            logger.info('StateMachine', `State changed: ${oldState} -> ${this.currentState}`);
        }
    }

    getState() {
        return this.currentState;
    }
}

module.exports = new StateMachine();
