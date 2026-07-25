const os = require('os');
const path = require('path');
const fs = require('fs');

class Logger {
    constructor() {
        this.logDir = path.join(os.homedir(), '.aevr', 'logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFile() {
        const dateStr = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `${dateStr}.log`);
    }

    _write(level, module, message, meta = {}) {
        const timestamp = new Date().toISOString();
        let logObj = { timestamp, level, module, message };
        
        if (Object.keys(meta).length > 0) {
            logObj.meta = meta;
        }

        const logLineStr = JSON.stringify(logObj);
        const logDisplay = `[${timestamp}] [${level}] [${module}] ${message}`;

        console.log(logDisplay);

        try {
            fs.appendFileSync(this.getLogFile(), logLineStr + '\n');
        } catch (e) {
            console.error("Failed to write to log file:", e);
        }
    }

    info(module, message, meta = {}) {
        this._write('INFO', module, message, meta);
    }

    warn(module, message, meta = {}) {
        this._write('WARN', module, message, meta);
    }

    error(module, message, errorObj = {}) {
        const meta = {
            errorMsg: errorObj.message,
            stack: errorObj.stack,
        };
        this._write('ERROR', module, message, meta);
    }
}

module.exports = new Logger();
