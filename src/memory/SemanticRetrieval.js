const logger = require('../utils/logger');

/**
 * A lightweight Keyword-based Semantic Retrieval engine.
 * For V1, this simulates semantic search by extracting keywords from the query
 * and matching them against a stored history of past contexts.
 * For V2, this could be replaced with ChromaDB or SQLite-vss.
 */
class SemanticRetrieval {
    constructor() {
        this.longTermStorage = [];
    }

    archive(contextString, metadata = {}) {
        this.longTermStorage.push({
            content: contextString,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        });
        logger.info('SemanticRetrieval', `Archived context to long-term storage`, metadata);
    }

    _extractKeywords(query) {
        return query.toLowerCase().split(/\W+/).filter(word => word.length > 3);
    }

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

        // Filter and sort by score
        const relevant = scoredResults
            .filter(res => res.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(res => res.item);

        logger.info('SemanticRetrieval', `Found ${relevant.length} relevant past contexts for query`, { keywords });
        return relevant;
    }
}

module.exports = new SemanticRetrieval();
