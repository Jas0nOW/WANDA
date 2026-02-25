// =============================================================================
// Wanda — Provider Configuration (OAuth + API Key)
// =============================================================================
// Builds provider config from environment + token store.
// OAuth has priority over API keys.

import type { ProviderRegistryConfig, ProviderAccount, TokenStore } from '@wanda/providers';

export interface ProviderEnv {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    geminiApiKey?: string;
    moonshotApiKey?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    defaultModelRef?: string;
}

const FALLBACK_PRIMARY_DEFAULT = 'gemini/oauth/gemini-3.1-pro-high';

function hasValue(value?: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function sanitize(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

/**
 * Build provider config from env, secrets, and OAuth token store.
 * Providers with OAuth tokens are included even without API keys.
 */
export function buildProviderConfig(
    env: ProviderEnv,
    tokenStore?: TokenStore,
): ProviderRegistryConfig {
    const providers: ProviderRegistryConfig['providers'] = {};
    const activeModelRefs = new Set<string>();

    const anthropicApiKey = sanitize(env.anthropicApiKey);
    const openaiApiKey = sanitize(env.openaiApiKey);
    const geminiApiKey = sanitize(env.geminiApiKey);
    const moonshotApiKey = sanitize(env.moonshotApiKey);
    const defaultModelRef = sanitize(env.defaultModelRef);

    // --- Anthropic (API key only) ---
    if (hasValue(anthropicApiKey)) {
        providers.anthropic = {
            accounts: [{
                id: 'main',
                providerId: 'anthropic',
                auth: { type: 'api_key', key: anthropicApiKey! },
                models: ['claude-4.6-sonnet', 'claude-4.6-opus'],
                enabled: true,
            }],
        };
    }

    // --- OpenAI (API key only) ---
    if (hasValue(openaiApiKey)) {
        providers.openai = {
            accounts: [{
                id: 'main',
                providerId: 'openai',
                auth: { type: 'api_key', key: openaiApiKey! },
                models: ['gpt-5.2', 'codex-5.3'],
                enabled: true,
            }],
        };
    }

    // --- Gemini (OAuth priority, API key fallback) ---
    // Primary account 'oauth' = Antigravity / Google OAuth (AI Pro subscription)
    // Secondary account 'cli' = Gemini CLI API key
    const geminiAccounts: ProviderAccount[] = [];
    const hasGeminiOAuth = tokenStore?.hasTokens('gemini', 'oauth') ?? false;

    if (hasGeminiOAuth) {
        geminiAccounts.push({
            id: 'oauth', // matches token key oauth-token:gemini:oauth
            providerId: 'gemini',
            auth: { type: 'oauth', token: 'managed-by-token-store' },
            models: ['gemini-3.1-pro-high', 'gemini-3.1-pro-low', 'gemini-3-flash', 'claude-4.6-sonnet', 'claude-4.6-opus'],
            enabled: true,
        });
    }

    if (hasValue(geminiApiKey)) {
        geminiAccounts.push({
            id: 'cli',
            providerId: 'gemini',
            auth: { type: 'api_key', key: geminiApiKey! },
            models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
            enabled: true,
        });
    }

    if (geminiAccounts.length > 0) {
        providers.gemini = { accounts: geminiAccounts };
    }

    // --- Kimi / Moonshot (API key only) ---
    if (hasValue(moonshotApiKey)) {
        providers.kimi = {
            accounts: [{
                id: 'main',
                providerId: 'kimi',
                auth: { type: 'api_key', key: moonshotApiKey! },
                models: ['kimi-code-k2p5'],
                enabled: true,
            }],
        };
    }

    // --- GitHub Copilot (OAuth only) ---
    const hasGithubOAuth = tokenStore?.hasTokens('github-copilot', 'oauth') ?? false;
    if (hasGithubOAuth) {
        providers['github-copilot'] = {
            accounts: [{
                id: 'oauth',
                providerId: 'github-copilot',
                auth: { type: 'oauth', token: 'managed-by-token-store' },
                models: ['claude-4.6-sonnet', 'claude-4.6-opus'],
                enabled: true,
            }],
        };
    }

    // --- Build fallback chain from available providers ---
    for (const [providerId, providerConfig] of Object.entries(providers)) {
        for (const account of providerConfig.accounts) {
            if (!account.enabled) continue;
            for (const model of account.models) {
                activeModelRefs.add(`${providerId}/${account.id}/${model}`);
            }
        }
    }

    const fallbackOrder: Set<string> = new Set();

    // Priority 1: User selected default
    if (defaultModelRef && activeModelRefs.has(defaultModelRef)) {
        fallbackOrder.add(defaultModelRef);
    }

    // Priority 2: Preferred order for real accounts
    const preferredRefs = [
        'gemini/oauth/gemini-3.1-pro-high',
        'anthropic/main/claude-4.6-sonnet',
        'openai/main/gpt-5.2',
        'github-copilot/oauth/claude-4.6-sonnet',
        'kimi/main/kimi-code-k2p5',
        'gemini/cli/gemini-3.1-pro-preview',
    ];
    for (const ref of preferredRefs) {
        if (activeModelRefs.has(ref)) {
            fallbackOrder.add(ref);
        }
    }

    // Priority 3: Add any remaining active refs deterministically
    for (const ref of Array.from(activeModelRefs).sort()) {
        fallbackOrder.add(ref);
    }

    const fallbackArray = Array.from(fallbackOrder);
    const primary = fallbackArray[0] ?? defaultModelRef ?? FALLBACK_PRIMARY_DEFAULT;
    const fallbacks = fallbackArray.slice(1);

    return {
        providers,
        agents: { default: { primary, fallbacks } },
        defaults: {
            primary,
            fallbacks,
            retryDelayMs: 1000,
            maxRetries: 3,
            circuitBreakerThreshold: 3,
            circuitBreakerResetMs: 300_000,
        },
    };
}
