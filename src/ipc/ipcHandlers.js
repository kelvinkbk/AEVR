const { ipcMain, desktopCapturer, BrowserWindow } = require('electron');
const eventBus = require('../core/EventBus');
const memoryManager = require('../memory/memoryManager');
const agentLoop = require('../core/agentLoop');
const registry = require('../tools/registry');
const convLogger = require('../utils/conversationLogger');

function registerIpcHandlers() {
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.setIgnoreMouseEvents(ignore, options);
    });

    ipcMain.handle('get-log-path', () => {
        return convLogger.getLogFilePath();
    });

    ipcMain.handle('send-message', async (event, message) => {
        try {
            eventBus.publish('state:change', 'Listening');
            eventBus.publish('state:change', 'Thinking');
            
            // The AI will use the analyze_screen tool if it needs to see the display.
            const result = await agentLoop.step(message, false, 0);
            
            eventBus.publish('state:change', 'Speaking');
            return result;
        } catch (error) {
            eventBus.publish('state:change', 'Error');
            eventBus.publish('log', { level: 'ERROR', module: 'IPCHandler', message: 'LLM Error processing message', meta: { errorMsg: error.message } });
            
            return { type: 'text', content: 'Agent Error: ' + error.message };
        }
    });

    ipcMain.handle('execute-tool', async (event, toolCallId, name, command, approved, currentIterations = 0) => {
        if (!approved) {
            convLogger.logToolOutput(name, 'REJECTED by user', { approved: false });
            memoryManager.addMessage({
                role: 'tool',
                tool_call_id: toolCallId,
                content: `User REJECTED tool execution: ${name}`
            });
            // Resume the loop so the LLM knows it was rejected and can plan accordingly
            return await agentLoop.step(null, true, currentIterations);
        }
        
        eventBus.publish('state:change', 'Executing');
        
        try {
            let args = {};
            try { args = JSON.parse(command); } catch (e) { args = { command: command, text: command }; }
            
            // Bypass permission check this time because UI already approved
            const tool = require('../tools/registry').getTool(name);
            const result = await tool.execute(args);
            
            convLogger.logToolOutput(name, typeof result === 'string' ? result : JSON.stringify(result, null, 2), { approved: true });
            memoryManager.addMessage({
                role: 'tool',
                tool_call_id: toolCallId,
                content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            });
            
            // Resume loop autonomously
            return await agentLoop.step(null, true, currentIterations);
            
        } catch (error) {
            eventBus.publish('state:change', 'Error');
            memoryManager.addMessage({
                role: 'tool',
                tool_call_id: toolCallId,
                content: `Execution failed: ${error.message}`
            });
            eventBus.publish('log', { level: 'ERROR', module: 'IPCHandler', message: 'Tool execution error', meta: { errorMsg: error.message } });
            
            // Resume loop so LLM can recover from the error
            return await agentLoop.step(null, true, currentIterations);
        }
    });
}

module.exports = { registerIpcHandlers };
