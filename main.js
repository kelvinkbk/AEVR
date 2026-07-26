require('dotenv').config();
const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const config = require('./src/config/config');                                                                                                                                  
const settingsStore = require('./src/config/settingsStore');
const logger = require('./src/utils/logger');
const eventBus = require('./src/core/EventBus');
const { registerIpcHandlers } = require('./src/ipc/ipcHandlers');
const metrics = require('./src/utils/metrics');
const backgroundWorkerPool = require('./src/workers/backgroundWorker');
const pluginManager = require('./src/plugins/PluginManager');

let tray = null;
let mainWindow = null;

logger.info('Main', 'Initializing AEVR Application...', { env: config.app.env });

function createWindow () {
  const windowState = settingsStore.get('ui.windowState') || { width: 600, height: 800, x: undefined, y: undefined };
  
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    transparent: true,
    frame: false,
    alwaysOnTop: settingsStore.get('ui.alwaysOnTop') !== false,
    resizable: true,
    skipTaskbar: settingsStore.get('ui.trayMode') === true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close', () => {
    if (!mainWindow.isFullScreen()) {
      const bounds = mainWindow.getBounds();
      settingsStore.set('ui.windowState', bounds);
    }
  });

  // Blur triggers hide if not pinned
  mainWindow.on('blur', () => {
      if (settingsStore.get('ui.alwaysOnTop') === false) {
          mainWindow.hide();
      }
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile('index.html');
  
  // Forward log events to frontend (if needed in future Dev Console)
  eventBus.subscribe('log', (logObj) => {
      try {
          if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('agent-log', logObj);
          }
      } catch (e) { }
  });
  
  // Forward state machine events to frontend
  eventBus.subscribe('state:change', (state) => {
      try {
          if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('agent-state', state);
          }
      } catch (e) {
          logger.error('Main', 'Failed to send state change to frontend', e);
      }
  });

  // Forward agent streaming chunks to frontend
  eventBus.subscribe('agent-stream', (chunk) => {
      try {
          if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('agent-stream', chunk);
          }
      } catch (e) { }
  });

  logger.info('Main', 'Main window created successfully');
}

function createTray() {
  // Create a 16x16 transparent dot if no icon exists, or use a proper icon in production
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let icon;
  try {
      icon = nativeImage.createFromPath(iconPath).resize({width: 16, height: 16});
  } catch(e) {
      // Dummy 1x1 image as fallback
      icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  tray.setToolTip('AEVR Assistant');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show AEVR', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Settings', click: () => { /* Future settings window */ } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
      if (mainWindow.isVisible()) {
          mainWindow.hide();
      } else {
          mainWindow.show();
          mainWindow.focus();
      }
  });
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  // Always create the window immediately so the user isn't stuck with a silent background process
  const startTimeMs = Date.now();
  createWindow();
  if (settingsStore.get('ui.trayMode')) {
      createTray();
  }
  registerIpcHandlers();

  // Initialize Background Workers & Plugins
  backgroundWorkerPool.init();
  pluginManager.loadPlugins();

  eventBus.publish('metrics:boot', Date.now() - startTimeMs);

  // Register DI Container for AgentLoop
  const diContainer = require('./src/core/diContainer');
  const ProviderFactory = require('./src/services/providers/ProviderFactory');
  
  ProviderFactory.getProvider(settingsStore.get('ai.provider') || 'Ollama')
    .then(provider => {
        diContainer.register('provider', provider);
        logger.info('Main', 'AI Provider initialized successfully');
    })
    .catch(e => {
        logger.error('Main', 'Failed to initialize AI Provider on boot', e);
        // The UI is already open, it can show an error state if the user tries to chat
    });
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Start a minimal HTTP server for browser-based testing
  const http = require('http');
  const agentLoop = require('./src/core/agentLoop');
  const memoryManager = require('./src/memory/memoryManager');
  const httpTestServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
              try {
                  const data = JSON.parse(body);
                  let result;
                  if (req.url === '/api/message') {
                      eventBus.publish('state:change', 'Listening');
                      eventBus.publish('state:change', 'Thinking');
                      result = await agentLoop.step(data.message, false, 0);
                      eventBus.publish('state:change', 'Speaking');
                  } else if (req.url === '/api/execute') {
                      if (!data.approved) {
                          memoryManager.addMessage({ role: 'tool', tool_call_id: data.toolCallId, content: `User REJECTED tool execution: ${data.name}` });
                          result = await agentLoop.step(null, true, data.iterations);
                      } else {
                          eventBus.publish('state:change', 'Executing');
                          let args = {};
                          try { args = JSON.parse(data.command); } catch (e) { args = { command: data.command, text: data.command }; }
                          const tool = require('./src/tools/registry').getTool(data.name);
                          const toolResult = await tool.execute(args);
                          memoryManager.addMessage({ role: 'tool', tool_call_id: data.toolCallId, content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2) });
                          result = await agentLoop.step(null, true, data.iterations);
                      }
                  } else {
                      res.writeHead(404); return res.end();
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(result));
              } catch (e) {
                  eventBus.publish('state:change', 'Error');
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ type: 'text', content: 'Agent Error: ' + e.message }));
              }
          });
      } else {
          res.writeHead(404); res.end();
      }
  });
  httpTestServer.listen(3333, () => logger.info('Main', 'Local test server listening on port 3333'));
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
