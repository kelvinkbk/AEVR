require('dotenv').config();
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

const stateMachine = require('./src/state/stateMachine');
const memory = require('./src/agent/memory');
const planner = require('./src/agent/planner');
const executor = require('./src/agent/executor');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile('index.html');
  
  // Forward state machine events to frontend
  stateMachine.on('stateChanged', (state) => {
      mainWindow.webContents.send('agent-state', state);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(ignore, options);
});

// IPC Handler to process chat messages via the Agent Core
ipcMain.handle('send-message', async (event, message) => {
    try {
        stateMachine.setState(stateMachine.states.LISTENING);
        
        let screenshotDataUrl = null;
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
            if (sources.length > 0) {
                screenshotDataUrl = sources[0].thumbnail.toDataURL();
            }
        } catch (captureErr) {
            console.error("Screen capture failed:", captureErr);
        }
        
        stateMachine.setState(stateMachine.states.THINKING);
        
        // Add to memory
        memory.addMessage('user', message);
        
        // Planning
        const planResult = await planner.generatePlan(message, screenshotDataUrl);
        
        // Ensure planResult has tool calls, else return text
        if (planResult.tool_calls && planResult.tool_calls.length > 0) {
            const toolCall = planResult.tool_calls[0];
            return {
                type: 'tool_call',
                id: toolCall.id,
                name: toolCall.function.name,
                command: toolCall.function.arguments,
                text: planResult.content
            };
        } else if (planResult.content && planResult.content.includes("```html")) {
            // Auto-fallback code extraction logic
            const codeMatch = planResult.content.match(/```(?:html|javascript|css)?\n([\s\S]*?)```/);
            if (codeMatch) {
                const escapedCode = codeMatch[1].replace(/"/g, '\\"').replace(/\n/g, '\\n');
                const fakeJson = `{"filepath":"C:\\\\Users\\\\kelvX2006\\\\Desktop\\\\calculator.html", "content":"${escapedCode}"}`;
                return {
                    type: 'tool_call',
                    id: 'auto_extracted_' + Date.now(),
                    name: 'write_to_file',
                    command: fakeJson,
                    text: "I have prepared the code. Click Approve to apply it."
                };
            }
        }
        
        stateMachine.setState(stateMachine.states.SPEAKING);
        
        return {
            type: 'text',
            content: planResult.content || "I finished analyzing, but I didn't output any code."
        };
    } catch (error) {
        stateMachine.setState(stateMachine.states.ERROR);
        console.error('LLM Error:', error);
        const errLog = `[${new Date().toISOString()}] Agent Error: ${error.stack || error.message}\n`;
        fs.appendFileSync(path.join(__dirname, 'suis-error.log'), errLog);
        return { type: 'text', content: 'Agent Error: ' + error.message };
    }
});

// IPC Handler to execute approved tools
ipcMain.handle('execute-tool', async (event, toolCallId, name, command, approved) => {
    if (!approved) {
        memory.addMessage('tool', `User REJECTED tool execution: ${name}`);
        return { type: 'text', content: "Tool execution aborted by user." };
    }
    
    stateMachine.setState(stateMachine.states.EXECUTING);
    
    try {
        let args = {};
        try { args = JSON.parse(command); } catch (e) { args = { command: command, text: command }; }
        
        const result = await executor.executeToolCall(name, args);
        memory.addMessage('tool', result);
        
        stateMachine.setState(stateMachine.states.IDLE);
        return { type: 'text', content: `Tool execution complete. Result: ${result}` };
    } catch (error) {
        stateMachine.setState(stateMachine.states.ERROR);
        memory.addMessage('tool', `Execution failed: ${error.message}`);
        return { type: 'text', content: `Execution failed: ${error.message}` };
    }
});
