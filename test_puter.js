const { puter } = require('@heyputer/puter.js');

async function test() {
    const tools = [
        {
            type: "function",
            function: {
                name: "get_weather",
                description: "Get the current weather in a given location",
                parameters: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "The city and state, e.g. San Francisco, CA"
                        },
                        unit: {
                            type: "string",
                            enum: ["celsius", "fahrenheit"]
                        }
                    },
                    required: ["location"]
                }
            }
        }
    ];

    try {
        const response = await puter.ai.chat(
            "What is the weather like in Boston?",
            { model: 'claude-sonnet-5', tools: tools }
        );
        console.log("Response structure:");
        console.log(JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
