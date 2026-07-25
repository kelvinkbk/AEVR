const memoryManager = require('../memory/memoryManager');
const logger = require('../utils/logger');
const diContainer = require('./diContainer');
const planner = require('./planner');
const executor = require('../tools/executor');
const registry = require('../tools/registry');
const stateMachine = require('./stateMachine');

class AgentLoop {
    constructor() {
        this.maxIterations = 10;
    }

    async step(request, screenshotDataUrl = null, isResume = false) {
        logger.info('AgentLoop', isResume ? 'Resuming execution loop' : 'Starting new execution loop');
        
        if (!isResume && request) {
            memoryManager.addMessage('user', request);
            stateMachine.setState(stateMachine.states.PLANNING);
            
            // Generate Plan
            const plan = await planner.createPlan(request);
            logger.info('AgentLoop', 'Plan generated', { steps: plan.length });
            
            memoryManager.addMessage('system', `Plan generated:\n${JSON.stringify(plan, null, 2)}`);
        }

        const provider = diContainer.get('provider');
        let iterations = 0;

        while (iterations < this.maxIterations) {
            iterations++;
            stateMachine.setState(stateMachine.states.THINKING);
            
            const context = memoryManager.getContextForModel(screenshotDataUrl);
            const tools = registry.getSchemas();

            try {
                const response = await provider.chat(context, tools);

                if (response.type === 'text') {
                    // LLM decided to speak to the user, ending the loop
                    memoryManager.addMessage('assistant', response.content);
                    return response;
                }

                if (response.type === 'tool_call') {
                    // Output the thought if any
                    if (response.text) {
                        memoryManager.addMessage('assistant', response.text);
                    }

                    stateMachine.setState(stateMachine.states.EXECUTING);
                    
                    let args = {};
                    try { args = typeof response.command === 'string' ? JSON.parse(response.command) : response.command; } 
                    catch (e) { args = { command: response.command }; }

                    const execResult = await executor.executeToolCall(response.name, args);

                    if (execResult && execResult.requiresUIApproval) {
                        stateMachine.setState(stateMachine.states.WAITING_APPROVAL);
                        // Return control to UI to ask for permission
                        return {
                            type: 'tool_call', // Using tool_call type so UI parses it as a permission prompt
                            id: response.id || `call_${Date.now()}`,
                            name: execResult.toolName,
                            command: JSON.stringify(execResult.args),
                            text: execResult.message,
                            requiresUIApproval: true
                        };
                    }

                    // Tool executed autonomously, add to memory and loop again
                    memoryManager.addMessage('tool', `Result of ${response.name}:\n${execResult}`);
                    continue; // Jump to next loop iteration
                }

            } catch (error) {
                logger.error('AgentLoop', 'Error during loop iteration', error);
                memoryManager.addMessage('system', `Error: ${error.message}. Please retry or adjust approach.`);
                
                if (iterations >= 3) {
                    throw error; // Fail completely if stuck in error loop
                }
            }
        }
        
        return { type: 'text', content: "I've hit my maximum thinking steps for this task." };
    }
}

module.exports = new AgentLoop();
