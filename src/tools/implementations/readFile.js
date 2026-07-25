const fs = require('fs');

module.exports = {
    name: 'read_file',
    permission: 'auto', // Safe to run automatically
    schema: {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Reads the contents of a file on the local filesystem.',
            parameters: {
                type: 'object',
                properties: {
                    filepath: { type: 'string', description: 'Absolute path to the file.' }
                },
                required: ['filepath']
            }
        }
    },
    execute: async (args) => {
        let parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        const { filepath } = parsedArgs;
        if (!fs.existsSync(filepath)) {
            throw new Error(`File not found: ${filepath}`);
        }
        return fs.readFileSync(filepath, 'utf8');
    }
};
