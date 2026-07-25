const fs = require('fs');
const path = require('path');
const os = require('os');
const eventBus = require('../core/EventBus');

class Metrics {
    constructor() {
        this.metrics = {
            startupTimeMs: 0,
            providerLatencies: [],
            toolLatencies: [],
            totalTokensUsed: 0,
            errorCount: 0
        };
        
        this.metricsFile = path.join(os.homedir(), '.aevr', 'metrics.json');
        this.loadMetrics();
        
        this._setupListeners();
    }

    _setupListeners() {
        eventBus.subscribe('metrics:boot', (timeMs) => this.record('startupTimeMs', timeMs));
        eventBus.subscribe('metrics:provider_latency', (timeMs) => this.recordArray('providerLatencies', timeMs));
        eventBus.subscribe('metrics:tool_latency', (timeMs) => this.recordArray('toolLatencies', timeMs));
        eventBus.subscribe('metrics:tokens', (count) => this.increment('totalTokensUsed', count));
        eventBus.subscribe('error:system', () => this.increment('errorCount', 1));
    }

    loadMetrics() {
        if (fs.existsSync(this.metricsFile)) {
            try {
                const data = fs.readFileSync(this.metricsFile, 'utf8');
                this.metrics = { ...this.metrics, ...JSON.parse(data) };
            } catch (e) {
                // Fail silently on corrupt metrics
            }
        }
    }

    saveMetrics() {
        try {
            fs.writeFileSync(this.metricsFile, JSON.stringify(this.metrics, null, 2));
        } catch (e) {
            // Fail silently
        }
    }

    record(key, value) {
        this.metrics[key] = value;
        this.saveMetrics();
    }

    recordArray(key, value) {
        if (!Array.isArray(this.metrics[key])) this.metrics[key] = [];
        this.metrics[key].push(value);
        if (this.metrics[key].length > 100) this.metrics[key].shift(); // Keep last 100
        this.saveMetrics();
    }

    increment(key, value = 1) {
        this.metrics[key] = (this.metrics[key] || 0) + value;
        this.saveMetrics();
    }
}

module.exports = new Metrics();
