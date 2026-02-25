import { afterEach, describe, expect, it } from 'vitest';
import { resolveMaxOutputTokens } from '../src/limits.js';

const KEY_GLOBAL = 'WANDA_MAX_OUTPUT_TOKENS';
const KEY_OPENAI = 'WANDA_MAX_OUTPUT_TOKENS_OPENAI';
const KEY_ANTHROPIC = 'WANDA_MAX_OUTPUT_TOKENS_ANTHROPIC';
const KEY_GEMINI = 'WANDA_MAX_OUTPUT_TOKENS_GEMINI';

const originalValues = {
    [KEY_GLOBAL]: process.env[KEY_GLOBAL],
    [KEY_OPENAI]: process.env[KEY_OPENAI],
    [KEY_ANTHROPIC]: process.env[KEY_ANTHROPIC],
    [KEY_GEMINI]: process.env[KEY_GEMINI],
};

function clearKeys(): void {
    delete process.env[KEY_GLOBAL];
    delete process.env[KEY_OPENAI];
    delete process.env[KEY_ANTHROPIC];
    delete process.env[KEY_GEMINI];
}

afterEach(() => {
    clearKeys();
    for (const [key, value] of Object.entries(originalValues)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
});

describe('resolveMaxOutputTokens', () => {
    it('uses internal default when no env is set', () => {
        clearKeys();
        expect(resolveMaxOutputTokens('openai')).toBe(2048);
        expect(resolveMaxOutputTokens('anthropic')).toBe(2048);
        expect(resolveMaxOutputTokens('gemini')).toBe(2048);
    });

    it('uses global env limit when provider-specific is absent', () => {
        clearKeys();
        process.env[KEY_GLOBAL] = '1200';
        expect(resolveMaxOutputTokens('openai')).toBe(1200);
        expect(resolveMaxOutputTokens('anthropic')).toBe(1200);
        expect(resolveMaxOutputTokens('gemini')).toBe(1200);
    });

    it('prefers provider-specific over global env', () => {
        clearKeys();
        process.env[KEY_GLOBAL] = '1000';
        process.env[KEY_OPENAI] = '3333';
        expect(resolveMaxOutputTokens('openai')).toBe(3333);
        expect(resolveMaxOutputTokens('anthropic')).toBe(1000);
    });

    it('clamps too-small and too-large values', () => {
        clearKeys();
        process.env[KEY_GLOBAL] = '1';
        expect(resolveMaxOutputTokens('gemini')).toBe(64);

        process.env[KEY_GLOBAL] = '20000';
        expect(resolveMaxOutputTokens('gemini')).toBe(8192);
    });
});
