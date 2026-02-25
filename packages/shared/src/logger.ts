// =============================================================================
// Wanda — Structured Logger (Pino)
// =============================================================================
// Mandatory secret redaction. No raw secrets in any log output.

import pino from 'pino';

/**
 * Patterns that MUST be redacted from all log output.
 * Matches common API key formats, secret:// handles, and bearer tokens.
 */
const SECRET_PATTERNS = [
    /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic API keys
    /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI-style keys (sk-proj-... etc.)
    /secret:\/\/[a-zA-Z0-9_-]+/g, // Secret handles
    /Bearer\s+[a-zA-Z0-9._-]+/gi, // Bearer tokens
    /ghp_[a-zA-Z0-9]{36,}/g, // GitHub tokens
    /gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth tokens
    /AIza[a-zA-Z0-9_-]{35}/g, // Google API keys
];

/**
 * Redact known secret patterns from a string.
 */
export function redactSecrets(input: string): string {
    let result = input;
    for (const pattern of SECRET_PATTERNS) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Custom serializer that redacts secrets from log values.
 */
function redactingSerializer(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactSecrets(value);
    }
    if (typeof value === 'object' && value !== null) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = typeof v === 'string' ? redactSecrets(v) : v;
        }
        return result;
    }
    return value;
}

/**
 * Create a Wanda logger instance with mandatory secret redaction.
 */
export function createLogger(options?: { level?: string; name?: string }): pino.Logger {
    return pino({
        name: options?.name ?? 'wanda',
        level: options?.level ?? 'info',
        serializers: {
            msg: redactingSerializer,
            err: pino.stdSerializers.err,
        },
        formatters: {
            log(object: Record<string, unknown>) {
                const result: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(object)) {
                    result[key] = typeof value === 'string' ? redactSecrets(value) : value;
                }
                return result;
            },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    });
}

export type Logger = pino.Logger;
