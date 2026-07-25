const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class SettingsStore {
    constructor() {
        this.settingsFile = path.join(__dirname, '..', '..', 'settings.json');
        this.defaultSettings = {
            ui: {
                theme: 'spectrum',
                accent: 'cyan',
                alwaysOnTop: true,
                trayMode: true,
                launchAtStartup: false
            },
            ai: {
                provider: 'Ollama', // 'Ollama', 'OpenAI', 'Anthropic'
                model: 'llama3.1',
                temperature: 0.1,
                maxTokens: 4096,
                developerMode: false
            },
            permissions: {
                // Persistent permissions e.g., { "run_terminal_command": "ask" }
            }
        };
        this.settings = this.loadSettings();
    }

    loadSettings() {
        if (!fs.existsSync(this.settingsFile)) {
            logger.info('SettingsStore', 'No settings found, creating defaults');
            this.saveSettings(this.defaultSettings);
            return this.defaultSettings;
        }

        try {
            const data = fs.readFileSync(this.settingsFile, 'utf8');
            return { ...this.defaultSettings, ...JSON.parse(data) };
        } catch (error) {
            logger.error('SettingsStore', 'Failed to load settings', error);
            return this.defaultSettings;
        }
    }

    saveSettings(newSettings) {
        try {
            fs.writeFileSync(this.settingsFile, JSON.stringify(newSettings, null, 2));
            this.settings = newSettings;
            logger.info('SettingsStore', 'Settings saved');
        } catch (error) {
            logger.error('SettingsStore', 'Failed to save settings', error);
        }
    }

    get(pathKey) {
        return pathKey.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, this.settings);
    }

    set(pathKey, value) {
        const keys = pathKey.split('.');
        const lastKey = keys.pop();
        const deepObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.settings);
        deepObj[lastKey] = value;
        this.saveSettings(this.settings);
    }
}

module.exports = new SettingsStore();
