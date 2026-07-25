const { ipcMain, desktopCapturer, BrowserWindow } = require('electron');
const stateMachine = require('../core/stateMachine');
const memoryManager = require('../memory/memoryManager');
const agentLoop = require('../core/agentLoop');
const executor = require('../tools/executor');
const logger = require('../utils/logger');

function registerIpcHandlers() {
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.setIgnoreMouseEvents(ignore, options);
    });

    ipcMain.handle('send-message', async (event, message) => {
        try {
            stateMachine.setState(stateMachine.states.LISTENING);
            
            stateMachine.setState(stateMachine.states.THINKING);
            
            // Note: screenshotDataUrl is now null. 
            // The AI will use the analyze_screen tool if it needs to see the display.
            const result = await agentLoop.step(message, null);
            
            stateMachine.setState(stateMachine.states.SPEAKING);
            return result;
        } catch (error) {
            stateMachine.setState(stateMachine.states.ERROR);
            logger.error('IPCHandler', 'LLM Error processing message', error);
            
            return { type: 'text', content: 'Agent Error: ' + error.message };
        }
    });

    ipcMain.handle('execute-tool', async (event, toolCallId, name, command, approved) => {
        if (!approved) {
            memoryManager.addMessage('tool', `User REJECTED tool execution: ${name}`);
            return { type: 'text', content: "Tool execution aborted by user." };
        }
        
        stateMachine.setState(stateMachine.states.EXECUTING);
        
        try {
            let args = {};
            try { args = JSON.parse(command); } catch (e) { args = { command: command, text: command }; }
            
            const result = await executor.executeToolCall(name, args);
            memoryManager.addMessage('tool', result);
            
            stateMachine.setState(stateMachine.states.IDLE);
            return { type: 'text', content: `Tool execution complete. Result: ${result}` };
        } catch (error) {
            stateMachine.setState(stateMachine.states.ERROR);
            memoryManager.addMessage('tool', `Execution failed: ${error.message}`);
            logger.error('IPCHandler', 'Tool execution error', error);
            return { type: 'text', content: `Execution failed: ${error.message}` };
        }
    });
}

module.exports = { registerIpcHandlers };
