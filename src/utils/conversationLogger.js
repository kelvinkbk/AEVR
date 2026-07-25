const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * ConversationLogger — writes a human-readable + machine-parseable log of every
 * interaction turn:
 *   • USER says …
 *   • ASSISTANT responds …
 *   • TOOL CALL  name(args)
 *   • TOOL OUTPUT …
 *
 * Log files are stored in ~/.aevr/conversation-logs/YYYY-MM-DD.jsonl
 * Each line is a standalone JSON object so the file is easy to grep / tail.
 */
class ConversationLogger {
    constructor() {
        this.logDir = path.join(os.homedir(), '.aevr', 'conversation-logs');
        this._ensureDir();
    }

    _ensureDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    _logFile() {
        const dateStr = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `${dateStr}.jsonl`);
    }

    _write(entry) {
        const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
        try {
            fs.appendFileSync(this._logFile(), line + '\n');
        } catch (e) {
            // Non-fatal — never crash the main process due to logging
            console.error('[ConversationLogger] Failed to write log:', e.message);
        }
        // Also echo a pretty summary to the main console
        this._pretty(entry);
    }

    _pretty(entry) {
        const { type, role, name, args, output, text } = entry;
        const pad = '  ';
        switch (type) {
            case 'user_message':
                console.log(`\n${'='.repeat(60)}\n[USER] ${text}\n`);
                break;
            case 'assistant_text':
                console.log(`[ASSISTANT] ${text}\n`);
                break;
            case 'tool_call':
                console.log(`[TOOL CALL] ${name}(${JSON.stringify(args)})`);
                break;
            case 'tool_output':
                const preview = typeof output === 'string'
                    ? output.slice(0, 300) + (output.length > 300 ? '…' : '')
                    : JSON.stringify(output).slice(0, 300);
                console.log(`[TOOL OUTPUT] ${preview}\n`);
                break;
        }
    }

    /** Call when the user sends a message */
    logUserMessage(text) {
        this._write({ type: 'user_message', text });
    }

    /** Call when the AI returns a plain text reply */
    logAssistantText(text) {
        this._write({ type: 'assistant_text', text });
    }

    /** Call when the AI requests a tool call */
    logToolCall(name, args) {
        this._write({ type: 'tool_call', name, args });
    }

    /** Call with the result of an executed tool */
    logToolOutput(name, output, { approved = true, error = false } = {}) {
        this._write({ type: 'tool_output', name, output, approved, error });
    }

    /** Return the path to today's log file so the UI can show it */
    getLogFilePath() {
        return this._logFile();
    }
}

module.exports = new ConversationLogger();
