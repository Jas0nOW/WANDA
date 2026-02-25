// =============================================================================
// Wanda — Google Gemini Provider
// =============================================================================
// Uses Gemini REST API. Auth: API key OR OAuth Bearer token.
// OAuth has priority when a TokenStore is provided.

import type { LLMMessage, LLMResponse, Logger } from '@wanda/shared';
import type { LLMProvider, ProviderAccount, ProviderFactory, ToolDefinitionForLLM } from './provider.js';
import type { TokenStore } from './auth/token-manager.js';
import { resolveMaxOutputTokens } from './limits.js';

export function createGeminiFactory(logger: Logger, tokenStore?: TokenStore): ProviderFactory {
    return (account: ProviderAccount): LLMProvider => {
        const apiKey = account.auth.type === 'api_key' ? account.auth.key : account.auth.token;
        const baseUrl = account.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
        const maxOutputTokens = resolveMaxOutputTokens('gemini');

        return {
            id: `gemini/${account.id}`,

            async chat(
                messages: LLMMessage[],
                tools: ToolDefinitionForLLM[],
                model: string,
            ): Promise<LLMResponse> {
                // Try OAuth token first (priority)
                const oauthToken = tokenStore
                    ? await tokenStore.getAccessToken('gemini', account.id)
                    : null;
                logger.debug({ accountId: account.id, hasOAuthToken: !!oauthToken }, 'Gemini token resolution');
                logger.info({ accountId: account.id, hasOAuthToken: !!oauthToken, model }, 'Gemini chat called');

                // Map to Gemini format
                const systemInstruction = messages.find((m) => m.role === 'system');
                const conversationMessages = messages.filter((m) => m.role !== 'system');

                const contents = conversationMessages.map((msg) => {
                    if (msg.role === 'assistant') {
                        const parts: Array<Record<string, unknown>> = [];
                        if (msg.content) {
                            parts.push({ text: msg.content });
                        }
                        if (msg.toolCalls) {
                            for (const tc of msg.toolCalls) {
                                parts.push({
                                    functionCall: {
                                        name: tc.name,
                                        args: JSON.parse(tc.arguments),
                                    },
                                });
                            }
                        }
                        return { role: 'model', parts };
                    }

                    if (msg.role === 'tool') {
                        return {
                            role: 'user',
                            parts: [
                                {
                                    functionResponse: {
                                        name: msg.toolCallId ?? 'unknown',
                                        response: { result: msg.content },
                                    },
                                },
                            ],
                        };
                    }

                    return { role: 'user', parts: [{ text: msg.content }] };
                });

                const geminiTools = tools.length > 0
                    ? [{
                        functionDeclarations: tools.map((t) => ({
                            name: t.name,
                            description: t.description,
                            parameters: t.parameters,
                        })),
                    }]
                    : undefined;

                const requestBody: Record<string, unknown> = {
                    contents,
                    generationConfig: { maxOutputTokens },
                };

                if (systemInstruction) {
                    requestBody.systemInstruction = {
                        parts: [{ text: systemInstruction.content }],
                    };
                }

                if (geminiTools) {
                    requestBody.tools = geminiTools;
                }

                // Build URL and headers based on auth method
                let url: string;
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };

                if (oauthToken) {
                    // OAuth: Bearer token, no key in URL
                    url = `${baseUrl}/models/${model}:generateContent`;
                    headers['Authorization'] = `Bearer ${oauthToken}`;
                    logger.debug({ model, accountId: account.id, auth: 'oauth', maxOutputTokens }, 'Calling Gemini (OAuth)');
                } else {
                    // API key: append to URL
                    url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
                    logger.debug({ model, accountId: account.id, auth: 'api_key', maxOutputTokens }, 'Calling Gemini (API key)');
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`Gemini API error ${response.status}: ${body}`);
                }

                const data = await response.json() as {
                    candidates?: Array<{
                        content?: {
                            parts?: Array<{
                                text?: string;
                                functionCall?: { name: string; args: Record<string, unknown> };
                            }>;
                        };
                        finishReason?: string;
                    }>;
                    usageMetadata?: {
                        promptTokenCount?: number;
                        candidatesTokenCount?: number;
                    };
                };

                const candidate = data.candidates?.[0];
                if (!candidate?.content?.parts) {
                    throw new Error('No content in Gemini response');
                }

                let textContent = '';
                const toolCalls: LLMResponse['toolCalls'] = [];

                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent += part.text;
                    }
                    if (part.functionCall) {
                        toolCalls.push({
                            id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            name: part.functionCall.name,
                            arguments: JSON.stringify(part.functionCall.args),
                        });
                    }
                }

                return {
                    content: textContent,
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    usage: data.usageMetadata
                        ? {
                            inputTokens: data.usageMetadata.promptTokenCount ?? 0,
                            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
                        }
                        : undefined,
                    stopReason: candidate.finishReason ?? undefined,
                };
            },
        };
    };
}
