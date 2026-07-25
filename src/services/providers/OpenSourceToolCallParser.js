class OpenSourceToolCallParser {
    parse(response) {
        const message = response?.choices?.[0]?.message || response?.message || {};
        const nativeToolCalls = this._normalizeToolCalls(message.tool_calls);

        if (nativeToolCalls.length > 0) {
            return this._buildToolCallResponse(message, nativeToolCalls);
        }

        const content = typeof message.content === 'string' ? message.content.trim() : '';
        if (!content) {
            return { type: 'text', content: '' };
        }

        const parsed = this._parseJsonEnvelope(content);
        if (parsed) {
            if (this._looksLikeToolCallEnvelope(parsed)) {
                const toolCalls = this._normalizeToolCalls(parsed.tool_calls || parsed.toolCalls || parsed.tool_call || parsed.toolCall || parsed);
                if (toolCalls.length > 0) {
                    return this._buildToolCallResponse({ ...parsed, content: parsed.content || '' }, toolCalls);
                }
            }

            const finalText = this._extractFinalText(parsed);
            if (typeof finalText === 'string') {
                return { type: 'text', content: finalText };
            }
        }

        return { type: 'text', content };
    }

    _buildToolCallResponse(message, toolCalls) {
        const assistantMessage = {
            role: 'assistant',
            content: typeof message.content === 'string' ? message.content : '',
            tool_calls: toolCalls
        };

        const primaryToolCall = toolCalls[0];

        return {
            type: 'tool_call',
            content: assistantMessage.content,
            text: assistantMessage.content,
            assistantMessage,
            toolCalls,
            toolCall: primaryToolCall,
            id: primaryToolCall.id,
            name: primaryToolCall.function.name,
            command: primaryToolCall.function.arguments
        };
    }

    _normalizeToolCalls(rawToolCalls) {
        const entries = Array.isArray(rawToolCalls) ? rawToolCalls : rawToolCalls ? [rawToolCalls] : [];
        return entries
            .map((toolCall, index) => this._normalizeToolCall(toolCall, index))
            .filter(Boolean);
    }

    _normalizeToolCall(rawToolCall, index) {
        const functionBlock = rawToolCall && typeof rawToolCall === 'object' && rawToolCall.function
            ? rawToolCall.function
            : rawToolCall;

        const functionName = functionBlock && typeof functionBlock === 'object'
            ? functionBlock.name || rawToolCall?.name
            : rawToolCall?.name;

        if (!functionName) {
            return null;
        }

        const rawArguments = functionBlock && typeof functionBlock === 'object'
            ? functionBlock.arguments !== undefined ? functionBlock.arguments : rawToolCall?.arguments
            : rawToolCall?.arguments;

        const normalizedArguments = this._normalizeArguments(rawArguments);

        return {
            id: rawToolCall?.id || `call_${Date.now()}_${index + 1}`,
            type: 'function',
            function: {
                name: functionName,
                arguments: normalizedArguments
            }
        };
    }

    _normalizeArguments(rawArguments) {
        if (rawArguments == null) {
            return {};
        }

        if (typeof rawArguments === 'string') {
            const parsed = this._safeJsonParse(rawArguments);
            if (parsed !== null) {
                return parsed;
            }

            return { command: rawArguments };
        }

        if (typeof rawArguments === 'object' && !Array.isArray(rawArguments)) {
            return rawArguments;
        }

        return { value: rawArguments };
    }

    _parseJsonEnvelope(content) {
        const directParse = this._safeJsonParse(content);
        if (directParse !== null) {
            return directParse;
        }

        const extracted = this._extractJsonDocument(content);
        if (!extracted) {
            return null;
        }

        return this._safeJsonParse(extracted);
    }

    _safeJsonParse(text) {
        try {
            return JSON.parse(text);
        } catch (error) {
            return null;
        }
    }

    _extractJsonDocument(text) {
        let startIndex = -1;
        const stack = [];
        let inString = false;
        let escaped = false;

        for (let index = 0; index < text.length; index++) {
            const character = text[index];

            if (startIndex === -1) {
                if (character === '{' || character === '[') {
                    startIndex = index;
                    stack.push(character);
                }
                continue;
            }

            if (inString) {
                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (character === '\\') {
                    escaped = true;
                    continue;
                }

                if (character === '"') {
                    inString = false;
                }

                continue;
            }

            if (character === '"') {
                inString = true;
                continue;
            }

            if (character === '{' || character === '[') {
                stack.push(character);
                continue;
            }

            if (character === '}' || character === ']') {
                const openingCharacter = stack.pop();
                if (!openingCharacter || !this._matchesBrackets(openingCharacter, character)) {
                    return null;
                }

                if (stack.length === 0) {
                    return text.slice(startIndex, index + 1);
                }
            }
        }

        return null;
    }

    _matchesBrackets(openingCharacter, closingCharacter) {
        return (openingCharacter === '{' && closingCharacter === '}') || (openingCharacter === '[' && closingCharacter === ']');
    }

    _looksLikeToolCallEnvelope(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return false;
        }

        const envelopeType = parsed.kind || parsed.type;
        if (envelopeType === 'tool_call' || envelopeType === 'tool' || envelopeType === 'action') {
            return true;
        }

        if (Array.isArray(parsed.tool_calls) || Array.isArray(parsed.toolCalls)) {
            return true;
        }

        if (parsed.tool_call || parsed.toolCall) {
            return true;
        }

        return typeof parsed.name === 'string' && parsed.arguments !== undefined;
    }

    _extractFinalText(parsed) {
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const envelopeType = parsed.kind || parsed.type;
        if (envelopeType === 'final' || envelopeType === 'text' || envelopeType === 'response') {
            return typeof parsed.content === 'string' ? parsed.content : '';
        }

        if (typeof parsed.final === 'string') {
            return parsed.final;
        }

        if (typeof parsed.content === 'string' && !this._looksLikeToolCallEnvelope(parsed)) {
            return parsed.content;
        }

        return null;
    }
}

module.exports = OpenSourceToolCallParser;
