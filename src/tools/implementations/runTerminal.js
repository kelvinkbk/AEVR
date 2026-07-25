const { exec } = require('child_process');

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
        let parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        const { command } = parsedArgs;
        
        return new Promise((resolve, reject) => {
            exec(command, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
                if (error) {
                    resolve(`Command failed:\n${stderr || error.message}`);
                    return;
                }
                resolve(stdout || "Command executed successfully with no output.");
            });
        });
    }
};
