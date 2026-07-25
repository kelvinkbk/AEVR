const { desktopCapturer } = require('electron');
const memoryManager = require('../../memory/memoryManager');

module.exports = {
    name: 'analyze_screen',
    permission: 'auto', // Taking a screenshot is safe and temporary
    schema: {
        type: 'function',
        function: {
            name: 'analyze_screen',
            description: 'Captures a screenshot of the user\'s primary display and adds it to your visual context so you can see what the user is looking at. Use this when the user asks you to look at something, read something on screen, or describe the screen.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    execute: async () => {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
            if (sources.length > 0) {
                const screenshotDataUrl = sources[0].thumbnail.toDataURL();
                // Inject into memory manager so the next LLM turn can see it
                memoryManager.latestScreenshot = screenshotDataUrl;
                return "Screen captured successfully. The image has been attached to your context. You can now see the screen.";
            } else {
                return "Failed to capture screen: No display sources found.";
            }
        } catch (error) {
            return `Failed to capture screen: ${error.message}`;
        }
    }
};
