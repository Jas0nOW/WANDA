// =============================================================================
// Wanda — OpenAI-Compatible Provider
// =============================================================================
// Works with OpenAI, OpenRouter, and any OpenAI-compatible API.
// Uses native fetch — no SDK dependency for maximum flexibility.

import type { LLMMessage, LLMResponse, Logger } from '@wanda/shared';
import type { LLMProvider, ProviderAccount, ProviderFactory, ToolDefinitionForLLM } from './provider.js';
import { resolveMaxOutputTokens } from './limits.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function createOpenAIFactory(logger: Logger): ProviderFactory {
    return (account: ProviderAccount): LLMProvider => {
        const apiKey = account.auth.type === 'api_key' ? account.auth.key : account.auth.token;
        const baseUrl = account.baseUrl ?? DEFAULT_BASE_URL;
        const maxOutputTokens = resolveMaxOutputTokens('openai');

        return {
            id: `openai/${account.id}`,

            async chat(
                messages: LLMMessage[],
                tools: ToolDefinitionForLLM[],
                model: string,
            ): Promise<LLMResponse> {
                // Map messages to OpenAI format
                const openaiMessages = messages.map((msg) => {
                    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                        return {
                            role: 'assistant' as const,
                            content: msg.content || null,
                            tool_calls: msg.toolCalls.map((tc) => ({
                                id: tc.id,
                                type: 'function' as const,
                                function: { name: tc.name, arguments: tc.arguments },
                            })),
                        };
                    }

                    if (msg.role === 'tool') {
                        return {
                            role: 'tool' as const,
                            tool_call_id: msg.toolCallId!,
                            content: msg.content,
                        };
                    }

                    return {
                        role: msg.role as 'system' | 'user' | 'assistant',
                        content: msg.content,
                    };
                });

                // Map tools to OpenAI format
                const openaiTools = tools.length > 0
                    ? tools.map((t) => ({
                        type: 'function' as const,
                        function: {
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters,
                        },
                    }))
                    : undefined;

                logger.debug({ model, accountId: account.id, baseUrl, maxOutputTokens }, 'Calling OpenAI-compatible');

                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages: openaiMessages,
                        tools: openaiTools,
                        max_tokens: maxOutputTokens,
                    }),
                });

                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`OpenAI API error ${response.status}: ${body}`);
                }

                const data = await response.json() as {
                    choices: Array<{
                        message: {
                            content?: string | null;
                            tool_calls?: Array<{
                                id: string;
                                function: { name: string; arguments: string };
                            }>;
                        };
                        finish_reason?: string;
                    }>;
                    usage?: { prompt_tokens: number; completion_tokens: number };
                };

                const choice = data.choices[0];
                if (!choice) throw new Error('No choices in OpenAI response');

                const toolCalls = choice.message.tool_calls?.map((tc) => ({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                }));

                return {
                    content: choice.message.content ?? '',
                    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
                    usage: data.usage
                        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
                        : undefined,
                    stopReason: choice.finish_reason ?? undefined,
                };
            },
        };
    };
}
