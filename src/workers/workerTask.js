const { parentPort } = require('worker_threads');

// A lightweight Keyword-based Semantic Retrieval engine logic for workers
const SemanticRetrieval = {
    longTermStorage: [],

    archive(contextString, metadata = {}) {
        this.longTermStorage.push({
            content: contextString,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
        return true;
    },

    _extractKeywords(query) {
        return query.toLowerCase().split(/\W+/).filter(word => word.length > 3);
    },

    search(query, maxResults = 3) {
        const keywords = this._extractKeywords(query);
        if (keywords.length === 0) return [];

        const scoredResults = this.longTermStorage.map(item => {
            const contentLower = item.content.toLowerCase();
            let score = 0;
            keywords.forEach(kw => {
                if (contentLower.includes(kw)) score++;
            });
            return { item, score };
        });

        return scoredResults
            .filter(res => res.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(res => res.item);
    }
};

parentPort.on('message', (msg) => {
    const { id, taskName, data } = msg;

    try {
        if (taskName === 'archiveMemory') {
            SemanticRetrieval.archive(data.contextString, data.metadata);
            parentPort.postMessage({ type: 'result', id, payload: { success: true } });
        } 
        else if (taskName === 'searchMemory') {
            const results = SemanticRetrieval.search(data.query, data.maxResults);
            parentPort.postMessage({ type: 'result', id, payload: results });
        }
    } catch (error) {
        parentPort.postMessage({ type: 'log', payload: { level: 'ERROR', module: 'WorkerTask', message: error.message } });
        parentPort.postMessage({ type: 'result', id, payload: { error: error.message } });
    }
});
