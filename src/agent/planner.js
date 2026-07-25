const OpenAI = require('openai');
const memory = require('./memory');

// Initialize Ollama
const ollama = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama'
});

class Planner {
    async generatePlan(request, screenshotDataUrl) {
        // Prepare context
        let context = [
            { role: 'system', content: 'You are a master web developer and AI desktop assistant. You have been given a screenshot of the user\'s screen. Your ONLY task is to fulfill the user\'s request. DO NOT describe the screenshot. DO NOT output conversational text. DO NOT use <thought> tags. If you need to edit code, output ONLY the improved code enclosed in a ```html markdown block. If you need to run a command, output it as JSON.' }
        ];

        let userMsg = { type: 'text', text: request };
        let contentArray = [userMsg];

        if (screenshotDataUrl) {
            contentArray.push({ type: 'image_url', image_url: { url: screenshotDataUrl } });
        }

        context.push({ role: 'user', content: contentArray });

        try {
            const response = await ollama.chat.completions.create({
                model: 'llava', // Use local vision for planning
                messages: context,
                max_tokens: 1024
            });

            return response.choices[0].message;
        } catch (error) {
            console.error("Planner failed:", error);
            throw error;
        }
    }
}

module.exports = new Planner();
