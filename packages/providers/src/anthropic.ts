// =============================================================================
// Wanda — Anthropic Provider
// =============================================================================
// Uses @anthropic-ai/sdk. Supports multi-account via ProviderAccount.

import Anthropic from '@anthropic-ai/sdk';
import type { LLMMessage, LLMResponse, Logger } from '@wanda/shared';
import type { LLMProvider, ProviderAccount, ProviderFactory, ToolDefinitionForLLM } from './provider.js';
import { resolveMaxOutputTokens } from './limits.js';

export function createAnthropicFactory(logger: Logger): ProviderFactory {
    return (account: ProviderAccount): LLMProvider => {
        const apiKey = account.auth.type === 'api_key' ? account.auth.key : account.auth.token;
        const client = new Anthropic({
            apiKey,
            ...(account.baseUrl ? { baseURL: account.baseUrl } : {}),
        });

        const maxOutputTokens = resolveMaxOutputTokens('anthropic');

        return {
            id: `anthropic/${account.id}`,

            async chat(
                messages: LLMMessage[],
                tools: ToolDefinitionForLLM[],
                model: string,
            ): Promise<LLMResponse> {
                // Separate system message
                const systemMessage = messages.find((m) => m.role === 'system');
                const conversationMessages = messages.filter((m) => m.role !== 'system');

                // Map to Anthropic format
                const anthropicMessages = conversationMessages.map((msg) => {
                    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                        const content: Anthropic.ContentBlockParam[] = [];
                        if (msg.content) {
                            content.push({ type: 'text', text: msg.content });
                        }
                        for (const tc of msg.toolCalls) {
                            content.push({
                                type: 'tool_use',
                                id: tc.id,
                                name: tc.name,
                                input: JSON.parse(tc.arguments),
                            });
                        }
                        return { role: 'assistant' as const, content };
                    }

                    if (msg.role === 'tool') {
                        return {
                            role: 'user' as const,
                            content: [
                                {
                                    type: 'tool_result' as const,
                                    tool_use_id: msg.toolCallId!,
                                    content: msg.content,
                                },
                            ],
                        };
                    }

                    return {
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                    };
                });

                // Map tools
                const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    input_schema: t.parameters as Anthropic.Tool.InputSchema,
                }));

                logger.debug({ model, accountId: account.id, maxOutputTokens }, 'Calling Anthropic');

                const response = await client.messages.create({
                    model,
                    max_tokens: maxOutputTokens,
                    system: systemMessage?.content,
                    messages: anthropicMessages,
                    tools: anthropicTools.length > 0 ? anthropicTools : undefined,
                });

                // Parse response
                let textContent = '';
                const toolCalls: LLMResponse['toolCalls'] = [];

                for (const block of response.content) {
                    if (block.type === 'text') {
                        textContent += block.text;
                    } else if (block.type === 'tool_use') {
                        toolCalls.push({
                            id: block.id,
                            name: block.name,
                            arguments: JSON.stringify(block.input),
                        });
                    }
                }

                return {
                    content: textContent,
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    usage: {
                        inputTokens: response.usage.input_tokens,
                        outputTokens: response.usage.output_tokens,
                    },
                    stopReason: response.stop_reason ?? undefined,
                };
            },
        };
    };
}
