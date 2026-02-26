import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionMessageToolCall } from 'openai/resources/index.js';

export interface LLMRequest {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    systemPrompt?: string;
}

export interface LLMResponse {
    content: string | null;
    toolCalls?: ChatCompletionMessageToolCall[];
}

export class LLMGateway {
    private client: OpenAI;
    private ollamaClient: OpenAI;

    constructor() {
        // Primary: OpenRouter
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY || 'dummy', // Prevent crash on missing
        });

        // Secondary Fallback: Local Ollama (running locally on standard port)
        this.ollamaClient = new OpenAI({
            baseURL: 'http://localhost:11434/v1',
            apiKey: 'ollama', // Ollama doesn't require a real key
        });
    }

    /**
     * Executes a chat completion. First tries OpenRouter with native multi-model fallback.
     * If the remote connection fails completely, drops down to local Ollama.
     */
    async generate(req: LLMRequest): Promise<LLMResponse> {
        let messagesToUse = req.messages;
        if (req.systemPrompt) {
            messagesToUse = [{ role: 'system', content: req.systemPrompt }, ...req.messages];
        }

        try {
            // Native OpenRouter Failover configuration
            const requestBody: any = {
                model: 'anthropic/claude-3.5-sonnet', // Default primary string
                messages: messagesToUse,
                tools: req.tools,
                // OpenRouter specific failover
                models: [
                    'anthropic/claude-3.5-sonnet',
                    'google/gemini-2.5-pro',
                    'meta-llama/llama-3.1-70b-instruct'
                ],
                route: 'fallback'
            };

            const response = await this.client.chat.completions.create(requestBody);

            const choice = response.choices[0];
            return {
                content: choice?.message?.content || null,
                toolCalls: choice?.message?.tool_calls
            };

        } catch (error) {
            console.error('[LLMGateway] OpenRouter failed, falling back to Ollama:', error);

            try {
                // Secondary fallback: Local execution completely offline
                const localResponse = await this.ollamaClient.chat.completions.create({
                    model: 'llama3:latest', // default local model
                    messages: messagesToUse,
                    tools: req.tools,
                });
                const fallbackChoice = localResponse.choices[0];
                return {
                    content: fallbackChoice?.message?.content || null,
                    toolCalls: fallbackChoice?.message?.tool_calls
                };
            } catch (ollamaError) {
                console.error('[LLMGateway] Ollama fallback also failed:', ollamaError);
                throw new Error("All LLM providers failed. System is offline.");
            }
        }
    }
}
