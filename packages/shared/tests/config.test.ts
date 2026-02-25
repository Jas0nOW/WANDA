// =============================================================================
// Tests — @wanda/shared: Config validation
// =============================================================================

import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
    const validEnv = {
        BOT_TOKEN: 'test-bot-token',
        ADMIN_TELEGRAM_ID: '123456789',
        ADMIN_TELEGRAM_CHAT_ID: '123456789',
        WANDA_SECRETS_MASTER_KEY: 'a'.repeat(64),
        LOG_LEVEL: 'debug',
    };

    it('loads valid config', () => {
        const config = loadConfig(validEnv);
        expect(config.botToken).toBe('test-bot-token');
        expect(config.adminTelegramId).toBe('123456789');
        expect(config.logLevel).toBe('debug');
        expect(config.loopMaxIterations).toBe(10);
        expect(config.loopTimeoutMs).toBe(120_000);
    });

    it('throws on missing BOT_TOKEN', () => {
        const env = { ...validEnv };
        delete env.BOT_TOKEN;
        expect(() => loadConfig(env)).toThrow();
    });

    it('throws on short master key', () => {
        expect(() => loadConfig({ ...validEnv, WANDA_SECRETS_MASTER_KEY: 'short' })).toThrow();
    });

    it('applies defaults for optional fields', () => {
        const config = loadConfig(validEnv);
        expect(config.nodeEnv).toBe('development');
        expect(config.dataDir).toBe('./data');
        expect(config.loopMaxToolCalls).toBe(5);
    });
});
