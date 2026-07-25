const { exec } = require('child_process');
const logger = require('../../utils/logger');

module.exports = {
    name: 'run_terminal_command',
    permission: 'ask', // Always ask for permission before running terminal commands
    schema: {
        type: "function",
        function: {
            name: "run_terminal_command",
            description: "Executes a PowerShell command on the user's Windows machine. Use this to open apps, read files, or control the system.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "The PowerShell command to run." }
                },
                required: ["command"]
            }
        }
    },
    execute: async (args) => {
        logger.info('runTerminal', `Received args type: ${typeof args}, value: ${JSON.stringify(args)}`);

        let parsedArgs = args;
        if (typeof args === 'string') {
            try {
                parsedArgs = JSON.parse(args);
            } catch (e) {
                logger.error('runTerminal', `Failed to parse args string: ${args}`);
                throw new Error(`Invalid JSON arguments: ${args}`);
            }
        }

        if (!parsedArgs || typeof parsedArgs !== 'object') {
            logger.error('runTerminal', `Parsed args is not an object: ${JSON.stringify(parsedArgs)}`);
            throw new Error(`Arguments must be an object, received: ${typeof parsedArgs}`);
        }

        const { command } = parsedArgs;

        if (!command || typeof command !== 'string' || command.trim() === '') {
            logger.error('runTerminal', `Invalid command: ${JSON.stringify(command)}`);
            throw new Error(`Invalid command: received "${command}". The command parameter must be a non-empty string.`);
        }

        logger.info('runTerminal', `Executing command: ${command}`);

        return new Promise((resolve, reject) => {
            exec(command, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
                if (error) {
                    logger.error('runTerminal', `Command execution failed: ${stderr || error.message}`);
                    resolve(`Command failed:\n${stderr || error.message}`);
                    return;
                }
                logger.info('runTerminal', `Command executed successfully`);
                resolve(stdout || "Command executed successfully with no output.");
            });
        });
    }
};
