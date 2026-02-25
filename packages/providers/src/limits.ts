const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const MIN_MAX_OUTPUT_TOKENS = 64;
const MAX_MAX_OUTPUT_TOKENS = 8192;

function parseInteger(value?: string): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Resolve max output tokens from env with provider override support.
 *
 * Priority:
 * 1) WANDA_MAX_OUTPUT_TOKENS_<PROVIDER>
 * 2) WANDA_MAX_OUTPUT_TOKENS
 * 3) internal default
 */
export function resolveMaxOutputTokens(provider: 'openai' | 'anthropic' | 'gemini'): number {
    const providerKey = `WANDA_MAX_OUTPUT_TOKENS_${provider.toUpperCase()}`;
    const providerValue = parseInteger(process.env[providerKey]);
    if (providerValue !== undefined) {
        return clamp(providerValue, MIN_MAX_OUTPUT_TOKENS, MAX_MAX_OUTPUT_TOKENS);
    }

    const globalValue = parseInteger(process.env['WANDA_MAX_OUTPUT_TOKENS']);
    if (globalValue !== undefined) {
        return clamp(globalValue, MIN_MAX_OUTPUT_TOKENS, MAX_MAX_OUTPUT_TOKENS);
    }

    return DEFAULT_MAX_OUTPUT_TOKENS;
}
