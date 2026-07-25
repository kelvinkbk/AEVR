const { Worker } = require('worker_threads');
const path = require('path');
const eventBus = require('../core/EventBus');

class BackgroundWorkerPool {
    constructor() {
        this.workers = [];
        this.workerPath = path.join(__dirname, 'workerTask.js');
    }

    init() {
        // Spin up one persistent background worker for now
        this._createWorker();
    }

    _createWorker() {
        const worker = new Worker(this.workerPath);
        
        worker.on('message', (msg) => {
            if (msg.type === 'log') {
                eventBus.publish('log', msg.payload);
            } else if (msg.type === 'result') {
                eventBus.publish(`worker:result:${msg.id}`, msg.payload);
            }
        });

        worker.on('error', (err) => {
            eventBus.publish('log', { level: 'ERROR', module: 'BackgroundWorker', message: 'Worker error', meta: { errorMsg: err.message } });
        });

        this.workers.push(worker);
    }

    executeTask(taskName, data) {
        return new Promise((resolve, reject) => {
            if (this.workers.length === 0) {
                return reject(new Error('No workers available'));
            }
            
            const worker = this.workers[0];
            const taskId = Date.now().toString();
            
            const onResult = (result) => {
                eventBus.unsubscribe(`worker:result:${taskId}`, onResult);
                resolve(result);
            };
            
            eventBus.subscribe(`worker:result:${taskId}`, onResult);
            
            worker.postMessage({ id: taskId, taskName, data });
        });
    }
}

module.exports = new BackgroundWorkerPool();
