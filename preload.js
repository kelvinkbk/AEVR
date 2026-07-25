const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readMemory: () => ipcRenderer.invoke('read-memory'),
  sendMessage: (msg) => ipcRenderer.invoke('send-message', msg),
  executeTool: (toolCallId, name, command, approved, iterations) => ipcRenderer.invoke('execute-tool', toolCallId, name, command, approved, iterations),
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  onAgentState: (callback) => ipcRenderer.on('agent-state', (_event, value) => callback(value))
});
