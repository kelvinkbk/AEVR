const memoryManager = require('../memory/memoryManager');
const eventBus = require('./EventBus');
const diContainer = require('./diContainer');
const planner = require('./planner');
const executor = require('../tools/executor');
const registry = require('../tools/registry');
const convLogger = require('../utils/conversationLogger');

class AgentLoop {
    constructor() {
        this.maxTaskIterations = 10;
        this.currentPlan = [];
        this.currentTaskIndex = 0;
    }

    _serializeToolResult(result) {
        if (typeof result === 'string') return result;
        if (result === null || result === undefined) return '';
        try { return JSON.stringify(result, null, 2); } catch (e) { return String(result); }
    }

    async step(request, isResume = false, currentIterations = 0) {
        eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: isResume ? 'Resuming execution loop' : 'Starting new execution loop' });

        if (!isResume && request) {
            this.currentPlan = [];
            this.currentTaskIndex = 0;

            convLogger.logUserMessage(request);
            memoryManager.addMessage('user', request);
            eventBus.publish('state:change', 'Planning');

            // Generate Plan
            const plan = await planner.createPlan(request);
            this.currentPlan = plan;
            eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: 'Plan generated', meta: { steps: plan.length } });
            memoryManager.addMessage('system', `Task Plan generated:\n${JSON.stringify(plan, null, 2)}`);
        }

        const provider = diContainer.get('provider');
        if (!provider) throw new Error('AI Provider not initialized');

        let iterations = currentIterations;

        // Task Graph Scheduler Loop
        while (this.currentTaskIndex < this.currentPlan.length) {
            const currentTask = this.currentPlan[this.currentTaskIndex];
            
            // Execute the current task (Executor loop)
            while (iterations < this.maxTaskIterations) {
                iterations++;
                eventBus.publish('state:change', 'Thinking');

                const context = memoryManager.getContextForModel();
                
                // Add the task_complete tool dynamically to the available tools for Reflection/Completion
                const tools = registry.getSchemas();
                tools.push({
                    type: "function",
                    function: {
                        name: "task_complete",
                        description: "Call this tool when you have fully completed the current assigned task and verified your work. Do not pass any arguments.",
                        parameters: { type: "object", properties: {}, required: [] }
                    }
                });

                // Add task context to system message
                const taskContextMsg = {
                    role: 'user',
                    content: `[TASK SCHEDULER]\nCurrent Task (${this.currentTaskIndex + 1}/${this.currentPlan.length}): "${currentTask.description}"\nPriority: ${currentTask.priority}\n\nExecute tools to achieve this task. When you are finished and have verified your work, use the 'task_complete' tool.`
                };
                
                // Inject the task context at the end of memory for the model
                const messagesWithContext = [...context, taskContextMsg];

                try {
                    const onStream = (chunk) => {
                        eventBus.publish('agent-stream', chunk);
                    };
                    
                    const response = await provider.chat(messagesWithContext, tools, onStream);

                    if (response.type === 'text') {
                        // The LLM spoke instead of calling a tool
                        convLogger.logAssistantText(response.content || '');
                        memoryManager.addMessage('assistant', response.content);
                        
                        // Treat speaking to user as pausing execution for now
                        eventBus.publish('state:change', 'Speaking');
                        return response;
                    }

                    if (response.type === 'tool_call') {
                        let arguments_ = response.arguments;
                        if (!arguments_) {
                            if (typeof response.command === 'string') {
                                try { arguments_ = JSON.parse(response.command); } catch (e) { arguments_ = { command: response.command }; }
                            } else if (response.command && typeof response.command === 'object') {
                                arguments_ = response.command;
                            } else {
                                arguments_ = {};
                            }
                        }

                        const toolCallObj = response.toolCall || {
                            id: response.id || `call_${Date.now()}`,
                            type: 'function',
                            function: { name: response.name, arguments: arguments_ }
                        };

                        const assistantMessage = response.assistantMessage || {
                            role: 'assistant',
                            content: response.text || '',
                            tool_calls: [toolCallObj]
                        };

                        memoryManager.addMessage(assistantMessage);

                        // Handle the dynamic 'task_complete' tool
                        if (toolCallObj.function.name === 'task_complete') {
                            memoryManager.addMessage({
                                role: 'tool',
                                tool_call_id: toolCallObj.id,
                                content: `Task marked as complete.`
                            });
                            
                            eventBus.publish('log', { level: 'INFO', module: 'AgentLoop', message: `Task ${currentTask.id} complete` });
                            
                            // Reflection Success! Move to next task
                            this.currentTaskIndex++;
                            iterations = 0;
                            break; // Break the executor while loop, go back to scheduler loop
                        }

                        // Normal Tool Execution
                        eventBus.publish('state:change', 'Executing');
                        
                        if (!toolCallObj.function.arguments) toolCallObj.function.arguments = {};
                        convLogger.logToolCall(toolCallObj.function.name, toolCallObj.function.arguments);
                        
                        const execResult = await executor.executeToolCall(toolCallObj.function.name, toolCallObj.function.arguments);

                        if (execResult && execResult.requiresUIApproval) {
                            eventBus.publish('state:change', 'Waiting Approval');
                            return {
                                type: 'tool_call',
                                id: toolCallObj.id,
                                name: execResult.toolName,
                                command: JSON.stringify(execResult.args),
                                text: execResult.message,
                                requiresUIApproval: true,
                                _iterations: iterations
                            };
                        }

                        convLogger.logToolOutput(toolCallObj.function.name, this._serializeToolResult(execResult));
                        memoryManager.addMessage({
                            role: 'tool',
                            tool_call_id: toolCallObj.id,
                            content: this._serializeToolResult(execResult)
                        });

                        continue; // Jump to next loop iteration
                    }

                } catch (error) {
                    eventBus.publish('log', { level: 'ERROR', module: 'AgentLoop', message: 'Error during loop iteration', meta: { errorMsg: error.message } });
                    memoryManager.addMessage('system', `Error: ${error.message}. Please retry or adjust approach.`);

                    if (iterations >= 3) {
                        throw error;
                    }
                }
            } // End of task executor while loop

            if (iterations >= this.maxTaskIterations) {
                eventBus.publish('log', { level: 'WARN', module: 'AgentLoop', message: `Task ${currentTask.id} hit max iterations. Moving to next task.` });
                memoryManager.addMessage('system', `[SYSTEM] The previous task exceeded the maximum allowed steps and was forcibly skipped.`);
                this.currentTaskIndex++;
                iterations = 0;
            }
        } // End of scheduler loop

        eventBus.publish('state:change', 'Speaking');
        return { type: 'text', content: "All tasks in the plan have been completed." };
    }
}

module.exports = new AgentLoop();
