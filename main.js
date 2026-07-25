require('dotenv').config();
const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const config = require('./src/config/config');
const settingsStore = require('./src/config/settingsStore');
const logger = require('./src/utils/logger');
const stateMachine = require('./src/core/stateMachine');
const { registerIpcHandlers } = require('./src/ipc/ipcHandlers');

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

app.whenReady().then(() => {
  // Always create the window immediately so the user isn't stuck with a silent background process
  createWindow();
  if (settingsStore.get('ui.trayMode')) {
      createTray();
  }
  registerIpcHandlers();

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
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
