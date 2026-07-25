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
                    // Fallback for smaller models (like llama3.2) that might output tool JSON in the text body
                    const jsonMatch = response.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || response.content.match(/(\{\s*"command"\s*:[\s\S]*?\})/);
                    
                    if (jsonMatch) {
                        try {
                            const rawToolCall = JSON.parse(jsonMatch[1]);
                            if (rawToolCall.command) {
                                // Convert to a tool_call response so the rest of the loop handles it properly
                                response.type = 'tool_call';
                                response.name = 'run_terminal_command';
                                response.command = { command: rawToolCall.command };
                                response.text = response.content; 
                                eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: 'Fallback parsed raw JSON into tool call' });
                            }
                        } catch (e) {
                            // ignore parse error and fall through to text
                        }
                    }

                    if (response.type === 'text') {
                        // LLM decided to speak to the user, ending the loop
                        memoryManager.addMessage('assistant', response.content);
                        return response;
                    }
                }

                if (response.type === 'tool_call') {
                    // Output the thought if any
                    if (response.text) {
                        memoryManager.addMessage('assistant', response.text);
                    }

                    eventBus.publish('state:change', 'Executing');
                    
                    let args = {};
                    try { args = typeof response.command === 'string' ? JSON.parse(response.command) : response.command; } 
                    catch (e) { args = { command: response.command }; }

                    const execResult = await executor.executeToolCall(response.name, args);

                    if (execResult && execResult.requiresUIApproval) {
                        eventBus.publish('state:change', 'Waiting Approval');
                        // Return control to UI to ask for permission, passing current iteration state
                        return {
                            type: 'tool_call', // Using tool_call type so UI parses it as a permission prompt
                            id: response.id || `call_${Date.now()}`,
                            name: execResult.toolName,
                            command: JSON.stringify(execResult.args),
                            text: execResult.message,
                            requiresUIApproval: true,
                            _iterations: iterations
                        };
                    }

                    // Tool executed autonomously, add to memory and loop again
                    memoryManager.addMessage('tool', `Result of ${response.name}:\n${execResult}`);
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
