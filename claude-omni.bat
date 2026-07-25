@echo off
echo Starting Claude Code through OmniRoute AI Gateway...
echo Make sure your OmniRoute server is running (e.g., via 'npx omniroute')!

set ANTHROPIC_BASE_URL=http://localhost:20128/v1
:: Anthropic SDK requires a key to be present (even a fake one) to avoid client-side crashes
set ANTHROPIC_API_KEY=dummy
:: Optional: force Claude to use a specific model from your OmniRoute combo
set ANTHROPIC_DEFAULT_OPUS_MODEL=claude-3-opus-20240229

claude %*
