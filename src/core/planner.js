const logger = require('../utils/logger');
const diContainer = require('./diContainer');

class Planner {
    constructor() {
        this.systemPrompt = {
            role: 'system',
            content: `You are the AEVR Advanced Planner. Your job is to take a user's complex request and break it into a logical, sequential JSON array of subtasks (a Task Graph). 
Each subtask must contain:
{
  "id": "task_1",
  "description": "What needs to be done",
  "priority": "high|medium|low",
  "dependencies": [] // array of task ids that must be completed first
}
Return ONLY valid JSON. Do not include markdown formatting or explanations. Dependencies ensure sequential execution.`
        };
    }

    async createPlan(userRequest) {
        logger.info('Planner', 'Creating execution plan for request');
        
        try {
            const provider = diContainer.get('provider');
            
            const messages = [
                this.systemPrompt,
                { role: 'user', content: `Create an execution plan for this request: ${userRequest}` }
            ];

            const response = await provider.chat(messages, [], null, { format: 'json' });
            
            if (response.type === 'text') {
                try {
                    let jsonText = response.content.trim();
                    if (jsonText.startsWith('```json')) {
                        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
                    }
                    const plan = JSON.parse(jsonText);
                    logger.info('Planner', `Successfully generated plan with ${Array.isArray(plan) ? plan.length : 1} steps.`);
                    return Array.isArray(plan) ? plan : [plan];
                } catch (e) {
                    logger.warn('Planner', 'Failed to parse JSON plan, falling back to raw text', e);
                    return [{ id: "task_1", description: response.content, priority: "high", dependencies: [] }];
                }
            }
            
            return [{ id: "task_1", description: userRequest, priority: "high", dependencies: [] }];

        } catch (error) {
            logger.error('Planner', 'Failed to create plan', error);
            // Fallback to simple single-step plan
            return [{ id: "task_1", description: userRequest, priority: "high", dependencies: [] }];
        }
    }
}

module.exports = new Planner();
