const { EventEmitter } = require('events');

class StateMachine extends EventEmitter {
    constructor() {
        super();
        this.states = {
            IDLE: 'Idle',
            LISTENING: 'Listening',
            THINKING: 'Thinking',
            EXECUTING: 'Executing',
            SPEAKING: 'Speaking',
            ERROR: 'Error'
        };
        this.currentState = this.states.IDLE;
    }

    setState(newState) {
        if (Object.values(this.states).includes(newState)) {
            this.currentState = newState;
            this.emit('stateChanged', this.currentState);
        } else {
            console.error(`Invalid state: ${newState}`);
        }
    }

    getState() {
        return this.currentState;
    }
}

module.exports = new StateMachine();
