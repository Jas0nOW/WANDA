// =============================================================================
// Wanda — Config Loader
// =============================================================================
// Two config levels:
// - `loadCliConfig()`: lightweight, only needs master key + data dir (for CLI tools)
// - `loadConfig()`:   full bot config, requires BOT_TOKEN and all required vars

import { z } from 'zod';
import type { WandaConfig } from './types.js';

// --- CLI config (only what auth/apikey commands need) ---

const cliConfigSchema = z.object({
    WANDA_SECRETS_MASTER_KEY: z
        .string()
        .length(64, 'WANDA_SECRETS_MASTER_KEY must be 64 hex characters'),
    DATA_DIR: z.string().default('./data'),
    LOG_LEVEL: z.string().default('info'),
});

export interface CliConfig {
    secretsMasterKey: string;
    dataDir: string;
    logLevel: string;
}

/**
 * Minimal config for CLI commands (auth, apikey, status).
 * Does NOT require BOT_TOKEN or other bot-specific vars.
 */
export function loadCliConfig(env: Record<string, string | undefined> = process.env): CliConfig {
    try {
        const parsed = cliConfigSchema.parse(env);
        return {
            secretsMasterKey: parsed.WANDA_SECRETS_MASTER_KEY,
            dataDir: parsed.DATA_DIR,
            logLevel: parsed.LOG_LEVEL,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
            `Wanda config error: ${msg}\n\n` +
            `Make sure WANDA_SECRETS_MASTER_KEY is set in your .env file.\n` +
            `Run from the project directory: /home/jannis/Schreibtisch/Work-OS/40_Products/Wanda-Repo`,
        );
    }
}

// --- Full bot config ---

const configSchema = z.object({
    BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
    ADMIN_TELEGRAM_ID: z.string().min(1, 'ADMIN_TELEGRAM_ID is required'),
    ADMIN_TELEGRAM_CHAT_ID: z.string().min(1, 'ADMIN_TELEGRAM_CHAT_ID is required'),
    WANDA_SECRETS_MASTER_KEY: z
        .string()
        .length(64, 'WANDA_SECRETS_MASTER_KEY must be 64 hex characters'),
    ANTHROPIC_API_KEY: z.string().optional(),
    LOG_LEVEL: z.string().default('info'),
    NODE_ENV: z.string().default('development'),
    LOOP_MAX_ITERATIONS: z.coerce.number().int().positive().default(10),
    LOOP_MAX_TOOL_CALLS: z.coerce.number().int().positive().default(5),
    LOOP_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    DATA_DIR: z.string().default('./data'),
});

/**
 * Full bot config. Throws if any required var is missing.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): WandaConfig {
    const parsed = configSchema.parse(env);

    return {
        botToken: parsed.BOT_TOKEN,
        adminTelegramId: parsed.ADMIN_TELEGRAM_ID,
        adminTelegramChatId: parsed.ADMIN_TELEGRAM_CHAT_ID,
        secretsMasterKey: parsed.WANDA_SECRETS_MASTER_KEY,
        anthropicApiKey: parsed.ANTHROPIC_API_KEY,
        logLevel: parsed.LOG_LEVEL,
        nodeEnv: parsed.NODE_ENV,
        loopMaxIterations: parsed.LOOP_MAX_ITERATIONS,
        loopMaxToolCalls: parsed.LOOP_MAX_TOOL_CALLS,
        loopTimeoutMs: parsed.LOOP_TIMEOUT_MS,
        dataDir: parsed.DATA_DIR,
    };
}
