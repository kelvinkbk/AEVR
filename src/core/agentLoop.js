const memoryManager = require('../memory/memoryManager');
const eventBus = require('./EventBus');
const diContainer = require('./diContainer');
const planner = require('./planner');
const executor = require('../tools/executor');
const registry = require('../tools/registry');

class AgentLoop {
    constructor() {
        this.maxIterations = 10;
    }

    _serializeToolResult(result) {
        if (typeof result === 'string') {
            return result;
        }

        if (result === null || result === undefined) {
            return '';
        }

        try {
            return JSON.stringify(result, null, 2);
        } catch (error) {
            return String(result);
        }
    }

    async step(request, isResume = false, currentIterations = 0) {
        eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: isResume ? 'Resuming execution loop' : 'Starting new execution loop' });
        
        if (!isResume && request) {
            memoryManager.addMessage('user', request);
            eventBus.publish('state:change', 'Planning');
            
            // Generate Plan
            const plan = await planner.createPlan(request);
            eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: 'Plan generated', meta: { steps: plan.length } });
            
            memoryManager.addMessage('system', `Plan generated:\n${JSON.stringify(plan, null, 2)}`);
        }

        const provider = diContainer.get('provider');
        let iterations = currentIterations;

        while (iterations < this.maxIterations) {
            iterations++;
            eventBus.publish('state:change', 'Thinking');
            
            // Vision is handled by analyze_screen tool, no need to pass explicit data here
            const context = memoryManager.getContextForModel();
            const tools = registry.getSchemas();

            try {
                const response = await provider.chat(context, tools);

                if (response.type === 'text') {
                    // LLM decided to speak to the user, ending the loop
                    memoryManager.addMessage('assistant', response.content);
                    return response;
                }

                if (response.type === 'tool_call') {
                    const assistantMessage = response.assistantMessage || {
                        role: 'assistant',
                        content: response.text || '',
                        tool_calls: [{
                            id: response.id || `call_${Date.now()}`,
                            type: 'function',
                            function: {
                                name: response.name,
                                arguments: response.command || {}
                            }
                        }]
                    };

                    memoryManager.addMessage(assistantMessage);

                    eventBus.publish('state:change', 'Executing');

                    const primaryToolCall = response.toolCall || assistantMessage.tool_calls[0];
                    const execResult = await executor.executeToolCall(primaryToolCall.function.name, primaryToolCall.function.arguments || {});

                    if (execResult && execResult.requiresUIApproval) {
                        eventBus.publish('state:change', 'Waiting Approval');
                        // Return control to UI to ask for permission, passing current iteration state
                        return {
                            type: 'tool_call', // Using tool_call type so UI parses it as a permission prompt
                            id: primaryToolCall.id,
                            name: execResult.toolName,
                            command: JSON.stringify(execResult.args),
                            text: execResult.message,
                            requiresUIApproval: true,
                            _iterations: iterations
                        };
                    }

                    // Native tool result injected directly into history
                    memoryManager.addMessage({
                        role: 'tool',
                        tool_call_id: primaryToolCall.id,
                        content: this._serializeToolResult(execResult)
                    });
                    
                    continue; // Jump to next loop iteration
                }

            } catch (error) {
                eventBus.publish('log', { level: 'ERROR', module: 'AgentLoop', message: 'Error during loop iteration', meta: { errorMsg: error.message } });
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
