const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logFile = path.join(__dirname, '..', '..', 'suis-error.log');
    }

    _write(level, module, message, meta = {}) {
        const timestamp = new Date().toISOString();
        let logLine = `[${timestamp}] [${level}] [${module}] ${message}`;
        
        if (Object.keys(meta).length > 0) {
            logLine += ` | Meta: ${JSON.stringify(meta)}`;
        }

        console.log(logLine);

        if (level === 'ERROR' || level === 'WARN') {
            try {
                fs.appendFileSync(this.logFile, logLine + '\n');
            } catch (e) {
                console.error("Failed to write to log file:", e);
            }
        }
    }

    info(module, message, meta) {
        this._write('INFO', module, message, meta);
    }

    warn(module, message, meta) {
        this._write('WARN', module, message, meta);
    }

    error(module, message, errorObj = {}) {
        const meta = {
            message: errorObj.message,
            stack: errorObj.stack,
        };
        this._write('ERROR', module, message, meta);
    }
}

module.exports = new Logger();
