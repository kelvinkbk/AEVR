const fs = require('fs');

module.exports = {
    name: 'write_to_file',
    permission: 'auto', // Allowed automatically to edit files smoothly, can be 'ask' if strictly needed
    schema: {
        type: "function",
        function: {
            name: "write_to_file",
            description: "Overwrites a file with new content. Use this to create or edit files.",
            parameters: {
                type: "object",
                properties: {
                    filepath: { type: "string", description: "Absolute path to the file." },
                    content: { type: "string", description: "The content to write to the file." }
                },
                required: ["filepath", "content"]
            }
        }
    },
    execute: async (args) => {
        let parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        const { filepath, content } = parsedArgs;
        fs.writeFileSync(filepath, content, 'utf8');
        return `Successfully wrote to ${filepath}`;
    }
};
