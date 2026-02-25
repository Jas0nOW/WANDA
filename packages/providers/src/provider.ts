// =============================================================================
// Wanda — LLM Provider Types
// =============================================================================
// Multi-provider, multi-account, fallback-aware type system.

import type { LLMMessage, LLMResponse } from '@wanda/shared';

// --- Tool Definition for LLM ---

export interface ToolDefinitionForLLM {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
}

// --- Authentication ---

export type AuthConfig =
    | { readonly type: 'api_key'; readonly key: string }
    | { readonly type: 'oauth'; readonly token: string };

// --- Provider Account ---

export interface ProviderAccount {
    readonly id: string;         // e.g., "main", "backup"
    readonly providerId: string; // e.g., "anthropic", "openai"
    readonly auth: AuthConfig;
    readonly models: string[];   // available model IDs
    readonly enabled: boolean;
    readonly baseUrl?: string;   // custom endpoint (OpenAI-compatible proxies)
}

// --- Model Reference ---

/** Parsed form of "provider/account/model" string */
export interface ModelRef {
    readonly provider: string;
    readonly account: string;
    readonly model: string;
}

/**
 * Parse a model reference string like "anthropic/main/claude-sonnet-4-20250514"
 * into a structured ModelRef.
 */
export function parseModelRef(ref: string): ModelRef {
    const parts = ref.split('/');
    if (parts.length < 3) {
        throw new Error(
            `Invalid model ref "${ref}". Expected format: "provider/account/model"`,
        );
    }
    return {
        provider: parts[0]!,
        account: parts[1]!,
        model: parts.slice(2).join('/'), // model IDs may contain slashes
    };
}

/**
 * Serialize a ModelRef back to string form.
 */
export function serializeModelRef(ref: ModelRef): string {
    return `${ref.provider}/${ref.account}/${ref.model}`;
}

// --- Agent Model Config ---

export interface AgentModelConfig {
    readonly primary: string;      // ModelRef string: "anthropic/main/claude-sonnet-4-20250514"
    readonly fallbacks: string[];  // ordered ModelRef strings
}

// --- Provider Config ---

export interface ProviderRegistryConfig {
    readonly providers: Record<string, {
        readonly accounts: ProviderAccount[];
    }>;
    readonly agents: Record<string, AgentModelConfig>;
    readonly defaults: {
        readonly primary: string;
        readonly fallbacks: string[];
        readonly retryDelayMs: number;
        readonly maxRetries: number;
        readonly circuitBreakerThreshold: number;
        readonly circuitBreakerResetMs: number;
    };
}

// --- LLM Provider Interface ---

export interface LLMProvider {
    readonly id: string;
    chat(
        messages: LLMMessage[],
        tools: ToolDefinitionForLLM[],
        model: string,
    ): Promise<LLMResponse>;
}

// --- Provider Factory ---

export type ProviderFactory = (account: ProviderAccount) => LLMProvider;
