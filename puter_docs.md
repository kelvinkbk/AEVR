Puter.js
Start Building
Platform
Resources
Docs
Pricing
Blog
42.8K
On this page
Getting Started
Example 1: Basic Text Generation with Claude Sonnet 5
Example 2: Streaming Responses for Longer Queries
Example 3: Using different Claude models
Example 4: Fast Mode with Smart Responses
Example 5: Complex Reasoning with Claude Fable 5
Available Models
Claude Free API Key
Conclusion
Related
Tutorials
Free, Unlimited Claude API
Nariman Jelveh, Reynaldi Chernando
Updated: July 1, 2026
This tutorial will show you how to use Puter.js to access Claude's advanced AI capabilities (such as Claude Fable 5, Claude Opus 4.8, Claude Sonnet 5, Claude Sonnet 4.6, Claude Haiku 4.5) for free, without any API keys, backend, or servers. Using Puter.js, you can generate text with Claude for a wide range of tasks, from creative writing to code generation and function calling without worrying about usage limits or costs.

Puter is the pioneer of the "User-Pays" model, which allows developers to incorporate AI capabilities into their applications while users cover their own usage costs. This model enables developers to access advanced AI capabilities for free, without any API keys or server-side setup.

Puter.js is also a particularly good fit for AI coding assistants, agents, and vibe coding tools such as Claude Code, Codex, OpenCode, Lovable, Replit, and others. Since it requires no API keys and no backend, the apps and programs these tools generate run end-to-end out of the box, with no third-party signup, no service to provision, and no keys to paste in. That removes a significant class of security risks along with the setup hurdles that typically prevent AI-generated apps from working on the first try.

Getting Started
To use Puter.js, import our npm module in your project:

// npm install @heyputer/puter.js
import { puter } from '@heyputer/puter.js';
Or alternatively, add our script via CDN if you are working directly with HTML, simply add it to the <head> or <body> section of your code:

<script src="https://js.puter.com/v2/"></script>
You're now ready to use Puter.js for free access to Claude capabilities. No API keys or sign-ups are required.

Example 1: Basic Text Generation with Claude Sonnet 5
To generate text using Claude, use the puter.ai.chat() function with your preferred model. Here's a full code example using Claude Sonnet 5:

<html>
<body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
        puter.ai.chat("Explain quantum computing in simple terms", {model: 'claude-sonnet-5'})
            .then(response => {
                puter.print(response.message.content[0].text);
            });
    </script>
</body>
</html>
Example 2: Streaming Responses for Longer Queries
For longer responses, use streaming to get results in real-time:

async function streamClaudeResponse(model = 'claude-sonnet-5') {
    const response = await puter.ai.chat(
        "Write a detailed essay on the impact of artificial intelligence on society", 
        {model: model, stream: true}
    );
    
    for await (const part of response) {
        puter.print(part?.text);
    }
}

// Use Claude Sonnet 5 (default)
streamClaudeResponse();
Here's the full code example with streaming:

<html>
<body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
        (async () => {
            const response = await puter.ai.chat(
                "Write a detailed essay on the impact of artificial intelligence on society", 
                {model: 'claude-sonnet-5', stream: true}
            );
            
            for await (const part of response) {
                puter.print(part?.text);
            }
        })();
    </script>
</body>
</html>
Example 3: Using different Claude models
You can specify different Claude models using the model parameter, for example claude-haiku-4-5 or claude-opus-4-5 or claude-opus-4-8:

// Using claude-haiku-4-5 model
puter.ai.chat(
    "Write a short poem about coding",
    { model: "claude-haiku-4-5" }
).then(response => {
    puter.print(response.message.content[0].text);
});

// Using claude-opus-4-8 model
puter.ai.chat(
    "Write a short poem about coding",
    { model: "claude-opus-4-8" }
).then(response => {
    puter.print(response.message.content[0].text);
});
Full code example:

<html>
<body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
        // Using claude-haiku-4-5 model
        puter.ai.chat(
            "Write a short poem about coding",
            { model: "claude-haiku-4-5" }
        ).then(response => {
            puter.print("<h2>Using claude-haiku-4-5 model</h2>");
            puter.print(response.message.content[0].text);
        });

        // Using claude-opus-4-8 model
        puter.ai.chat(
            "Write a short poem about coding",
            { model: "claude-opus-4-8" }
        ).then(response => {
            puter.print("<h2>Using claude-opus-4-8 model</h2>");
            puter.print(response.message.content[0].text);
        });
    </script>
</body>
</html>
Example 4: Fast Mode with Smart Responses
You can use Claude Opus 4.8 in fast mode — it's 2.5x faster than standard Opus 4.8 but 6x more expensive. Here's how to use it:

puter.ai.chat(
    "Explain quantum computing in simple terms",
    { model: "claude-opus-4.8-fast" }
).then(response => {
    puter.print(response);
});
Full code example:

<html>
<body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
        puter.ai.chat(
            "Explain quantum computing in simple terms",
            { model: "claude-opus-4.8-fast" }
        ).then(response => {
            puter.print(response);
        });
    </script>
</body>
</html>
Example 5: Complex Reasoning with Claude Fable 5
Claude Fable 5 is Anthropic's most capable model, state-of-the-art on nearly every benchmark and built for the hardest multi-step reasoning, coding, and long-horizon agentic tasks. When you need the smartest model there is — not just a fast or cheap one — this is the one to reach for:

(async () => {
    const response = await puter.ai.chat(
        `Five researchers — Ada, Boris, Chen, Diya, and Elena — each presented on a 
        different day, Monday through Friday, and each studies a different field: 
        biology, chemistry, physics, math, and linguistics.
        - The chemist presented earlier in the week than the biologist.
        - Elena presented on Wednesday.
        - The physicist presented the day immediately after Boris.
        - Ada studies math and did not present on Monday or Friday.
        - The linguist presented on Friday.
        - Diya is not the physicist and presented before Ada.
        Determine each researcher's day and field. Show your reasoning step by step, 
        and confirm your solution satisfies every clue.`,
        { model: "claude-fable-5", stream: true }
    );

    for await (const part of response) {
        puter.print(part?.text);
    }
})();
Full code example:

<html>
<body>
    <script src="https://js.puter.com/v2/"></script>
    <script>
        (async () => {
            const response = await puter.ai.chat(
                `Five researchers — Ada, Boris, Chen, Diya, and Elena — each presented on a 
                different day, Monday through Friday, and each studies a different field: 
                biology, chemistry, physics, math, and linguistics.
                - The chemist presented earlier in the week than the biologist.
                - Elena presented on Wednesday.
                - The physicist presented the day immediately after Boris.
                - Ada studies math and did not present on Monday or Friday.
                - The linguist presented on Friday.
                - Diya is not the physicist and presented before Ada.
                Determine each researcher's day and field. Show your reasoning step by step, 
                and confirm your solution satisfies every clue.`,
                { model: "claude-fable-5", stream: true }
            );

            for await (const part of response) {
                puter.print(part?.text);
            }
        })();
    </script>
</body>
</html>
Available Models
The following Claude models are available via Puter.js:

claude-fable-5
claude-sonnet-5
claude-opus-4.8-fast
claude-opus-4-8
claude-opus-4.7-fast
claude-opus-4-7
claude-sonnet-4-6
claude-opus-4-6
claude-opus-4-5
claude-haiku-4-5
claude-sonnet-4-5
claude-opus-4-1
claude-opus-4
claude-sonnet-4
Claude Free API Key
Anthropic gives you a one-time $5 credit when you sign up, which gets you a real Claude API key to try things out for free. But once that $5 is spent, you're back to the standard developer-pays model where every request your users make comes out of your account. Public GitHub repos that promise free API keys don't work either, since Anthropic revokes those keys fast and any app built on them breaks. With Puter.js, you don't have to deal with any of that. There's no API key to manage, no credit to burn through, and each user covers their own usage through their Puter account.
