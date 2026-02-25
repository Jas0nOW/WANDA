// =============================================================================
// Wanda — Model Router (Fallback Chains + Circuit Breaker)
// =============================================================================
// Resolves model references, handles auto-fallback across accounts and
// providers, and implements a circuit breaker to skip failing providers.

import type { LLMMessage, LLMResponse, Logger } from '@wanda/shared';
import type {
    LLMProvider,
    ProviderFactory,
    ProviderAccount,
    ProviderRegistryConfig,
    ToolDefinitionForLLM,
    ModelRef,
    AgentModelConfig,
} from './provider.js';
import { parseModelRef } from './provider.js';

// --- Circuit Breaker State ---

interface CircuitState {
    failures: number;
    openUntil: number; // timestamp (ms) — 0 = circuit closed
}

// --- Model Router ---

export interface ModelRouter {
    /**
     * Send a chat request, resolving model from agent config with auto-fallback.
     * @param agentId - Agent identifier (uses 'default' if not found)
     * @param messages - Conversation messages
     * @param tools - Available tool definitions
     */
    chat(
        agentId: string,
        messages: LLMMessage[],
        tools: ToolDefinitionForLLM[],
        overrides?: {
            readonly model?: string;
            readonly reasoning?: 'low' | 'high';
            readonly thinking?: boolean;
        }
    ): Promise<LLMResponse>;

    /**
     * Get the resolved model config for an agent.
     */
    getAgentConfig(agentId: string): AgentModelConfig;

    /**
     * List all registered provider accounts.
     */
    listAccounts(): Array<{ provider: string; account: string; models: string[]; enabled: boolean }>;
}

export function createModelRouter(
    config: ProviderRegistryConfig,
    factories: Map<string, ProviderFactory>,
    logger: Logger,
): ModelRouter {
    // --- Instantiate providers from accounts ---
    const providers = new Map<string, LLMProvider>(); // key: "provider/account"
    const circuitStates = new Map<string, CircuitState>(); // key: "provider/account"
    const accounts = new Map<string, ProviderAccount>(); // key: "provider/account"

    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
        const factory = factories.get(providerId);
        if (!factory) {
            logger.warn({ providerId }, 'No factory registered for provider — skipping');
            continue;
        }

        for (const account of providerConfig.accounts) {
            if (!account.enabled) {
                logger.info({ providerId, accountId: account.id }, 'Account disabled — skipping');
                continue;
            }

            const key = `${providerId}/${account.id}`;
            try {
                const provider = factory(account);
                providers.set(key, provider);
                accounts.set(key, account);
                circuitStates.set(key, { failures: 0, openUntil: 0 });
                logger.info(
                    { providerId, accountId: account.id, models: account.models },
                    'Provider account registered',
                );
            } catch (err) {
                logger.error({ err, providerId, accountId: account.id }, 'Failed to create provider');
            }
        }
    }

    // --- Helpers ---

    function isCircuitOpen(key: string): boolean {
        const state = circuitStates.get(key);
        if (!state) return true; // no state = not registered
        if (state.openUntil === 0) return false; // circuit closed
        if (Date.now() > state.openUntil) {
            // Reset after timeout (half-open → try again)
            state.failures = 0;
            state.openUntil = 0;
            logger.info({ accountKey: key }, 'Circuit breaker reset — retrying');
            return false;
        }
        return true;
    }

    function recordSuccess(key: string): void {
        const state = circuitStates.get(key);
        if (state) {
            state.failures = 0;
            state.openUntil = 0;
        }
    }

    function recordFailure(key: string): void {
        const state = circuitStates.get(key);
        if (!state) return;
        state.failures++;
        if (state.failures >= config.defaults.circuitBreakerThreshold) {
            state.openUntil = Date.now() + config.defaults.circuitBreakerResetMs;
            logger.warn(
                { accountKey: key, failures: state.failures, resetMs: config.defaults.circuitBreakerResetMs },
                'Circuit breaker OPEN — skipping provider',
            );
        }
    }

    function resolveAgentConfig(agentId: string): AgentModelConfig {
        return config.agents[agentId] ?? config.agents['default'] ?? {
            primary: config.defaults.primary,
            fallbacks: config.defaults.fallbacks,
        };
    }

    async function tryChat(
        ref: ModelRef,
        messages: LLMMessage[],
        tools: ToolDefinitionForLLM[],
    ): Promise<LLMResponse> {
        const key = `${ref.provider}/${ref.account}`;
        const provider = providers.get(key);

        if (!provider) {
            throw new Error(`No provider registered for ${key}`);
        }

        if (isCircuitOpen(key)) {
            throw new Error(`Circuit open for ${key}`);
        }

        try {
            const response = await provider.chat(messages, tools, ref.model);
            recordSuccess(key);
            return response;
        } catch (err) {
            recordFailure(key);
            throw err;
        }
    }

    function isRetryableError(err: unknown): boolean {
        if (err instanceof Error) {
            const msg = err.message.toLowerCase();
            // Rate limit, server errors, timeouts
            if (msg.includes('429') || msg.includes('rate limit')) return true;
            if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return true;
            if (msg.includes('timeout') || msg.includes('econnreset')) return true;
            if (msg.includes('circuit open')) return true;
            // Anthropic overload
            if (msg.includes('overloaded')) return true;
        }
        return false;
    }

    return {
        async chat(
            agentId: string,
            messages: LLMMessage[],
            tools: ToolDefinitionForLLM[],
            overrides?: {
                readonly model?: string;
                readonly reasoning?: 'low' | 'high';
                readonly thinking?: boolean;
            }
        ): Promise<LLMResponse> {
            const agentConfig = resolveAgentConfig(agentId);

            // If the user manually selected a model in UI, try it first
            const allRefs = overrides?.model
                ? [overrides.model, agentConfig.primary, ...agentConfig.fallbacks]
                : [agentConfig.primary, ...agentConfig.fallbacks];

            let lastError: Error | undefined;

            for (let i = 0; i < allRefs.length; i++) {
                const refStr = allRefs[i]!;
                let ref: ModelRef;
                try {
                    ref = parseModelRef(refStr);
                } catch {
                    logger.error({ ref: refStr }, 'Invalid model ref — skipping');
                    continue;
                }

                try {
                    logger.debug(
                        { ref: refStr, attempt: i + 1, total: allRefs.length },
                        i === 0 ? 'Trying primary model' : 'Trying fallback model',
                    );
                    return await tryChat(ref, messages, tools);
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                    logger.warn(
                        { ref: refStr, error: lastError.message, attempt: i + 1 },
                        i === 0 ? 'Primary model failed' : 'Fallback model failed',
                    );

                    if (!isRetryableError(err) && i === 0) {
                        // Non-retryable error on primary — still try fallbacks
                        // (might be a model-specific issue)
                    }

                    // Delay before next attempt (skip for circuit-open errors)
                    if (i < allRefs.length - 1 && config.defaults.retryDelayMs > 0) {
                        const errMsg = lastError.message.toLowerCase();
                        if (!errMsg.includes('circuit open')) {
                            await new Promise((resolve) => setTimeout(resolve, config.defaults.retryDelayMs));
                        }
                    }
                }
            }

            // All models exhausted
            throw new Error(
                `All LLM providers exhausted. Last error: ${lastError?.message ?? 'unknown'}`,
            );
        },

        getAgentConfig(agentId: string): AgentModelConfig {
            return resolveAgentConfig(agentId);
        },

        listAccounts(): Array<{ provider: string; account: string; models: string[]; enabled: boolean }> {
            const result: Array<{ provider: string; account: string; models: string[]; enabled: boolean }> = [];
            for (const [providerId, providerConf] of Object.entries(config.providers)) {
                for (const account of providerConf.accounts) {
                    result.push({
                        provider: providerId,
                        account: account.id,
                        models: account.models,
                        enabled: account.enabled,
                    });
                }
            }
            return result;
        },
    };
}
