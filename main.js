require('dotenv').config();
const { app, BrowserWindow } = require('electron');
const path = require('path');
const config = require('./src/config/config');
const logger = require('./src/utils/logger');
const stateMachine = require('./src/core/stateMachine');
const { registerIpcHandlers } = require('./src/ipc/ipcHandlers');

logger.info('Main', 'Initializing AEVR Application...', { env: config.app.env });

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
      try {
          if (!mainWindow.isDestroyed()) {
              mainWindow.webContents.send('agent-state', state);
          }
      } catch (e) {
          logger.error('Main', 'Failed to send state change to frontend', e);
      }
  });

  logger.info('Main', 'Main window created successfully');
}

app.whenReady().then(() => {
  createWindow();
  registerIpcHandlers();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
