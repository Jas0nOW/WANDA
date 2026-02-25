// =============================================================================
// Tests — @wanda/providers: ModelRouter fallback chains + circuit breaker
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createModelRouter } from '../src/router.js';
import type { ProviderRegistryConfig, ProviderFactory, ProviderAccount, LLMProvider } from '../src/provider.js';

// --- Mock Logger ---
const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: () => logger,
    level: 'silent',
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function mockProvider(id: string, response: () => Promise<any>): LLMProvider {
    return {
        id,
        chat: vi.fn((_msgs, _tools, _model) => response()),
    };
}

function mockFactory(provider: LLMProvider): ProviderFactory {
    return (_account: ProviderAccount) => provider;
}

const baseConfig: ProviderRegistryConfig = {
    providers: {
        providerA: {
            accounts: [
                { id: 'main', providerId: 'providerA', auth: { type: 'api_key', key: 'key-a' }, models: ['model-a'], enabled: true },
                { id: 'backup', providerId: 'providerA', auth: { type: 'api_key', key: 'key-a2' }, models: ['model-a'], enabled: true },
            ],
        },
        providerB: {
            accounts: [
                { id: 'main', providerId: 'providerB', auth: { type: 'api_key', key: 'key-b' }, models: ['model-b'], enabled: true },
            ],
        },
    },
    agents: {
        default: {
            primary: 'providerA/main/model-a',
            fallbacks: ['providerA/backup/model-a', 'providerB/main/model-b'],
        },
    },
    defaults: {
        primary: 'providerA/main/model-a',
        fallbacks: ['providerA/backup/model-a', 'providerB/main/model-b'],
        retryDelayMs: 0, // no delay in tests
        maxRetries: 3,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 100,
    },
};

describe('ModelRouter', () => {
    it('routes to primary model successfully', async () => {
        const provA = mockProvider('providerA/main', async () => ({
            content: 'Hello from A!', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));
        const provB = mockProvider('providerB/main', async () => ({
            content: 'Hello from B!', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));

        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(provA));
        factories.set('providerB', mockFactory(provB));

        const router = createModelRouter(baseConfig, factories, logger);
        const result = await router.chat('default', [{ role: 'user', content: 'hi' }], []);

        expect(result.content).toBe('Hello from A!');
    });

    it('falls back to second account on primary failure (429)', async () => {
        let callCount = 0;
        const provA = mockProvider('providerA', async () => {
            callCount++;
            if (callCount <= 1) throw new Error('429 rate limit');
            return { content: 'From backup account!', toolCalls: undefined, usage: undefined, stopReason: 'end' };
        });
        const provB = mockProvider('providerB/main', async () => ({
            content: 'Hello from B!', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));

        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(provA));
        factories.set('providerB', mockFactory(provB));

        const router = createModelRouter(baseConfig, factories, logger);
        const result = await router.chat('default', [{ role: 'user', content: 'hi' }], []);

        // Should get response from second account (same factory creates same provider in mock)
        expect(result.content).toBe('From backup account!');
    });

    it('falls back cross-provider when all accounts of primary fail', async () => {
        const provA = mockProvider('providerA', async () => {
            throw new Error('503 server error');
        });
        const provB = mockProvider('providerB/main', async () => ({
            content: 'From provider B!', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));

        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(provA));
        factories.set('providerB', mockFactory(provB));

        const router = createModelRouter(baseConfig, factories, logger);
        const result = await router.chat('default', [{ role: 'user', content: 'hi' }], []);

        expect(result.content).toBe('From provider B!');
    });

    it('throws when ALL providers are exhausted', async () => {
        const failProvider = mockProvider('fail', async () => {
            throw new Error('503 server error');
        });

        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(failProvider));
        factories.set('providerB', mockFactory(failProvider));

        const router = createModelRouter(baseConfig, factories, logger);

        await expect(router.chat('default', [{ role: 'user', content: 'hi' }], []))
            .rejects.toThrow('All LLM providers exhausted');
    });

    it('uses agent-specific config when available', async () => {
        const customConfig: ProviderRegistryConfig = {
            ...baseConfig,
            agents: {
                default: baseConfig.agents.default!,
                custom: {
                    primary: 'providerB/main/model-b',
                    fallbacks: [],
                },
            },
        };

        const provA = mockProvider('providerA/main', async () => ({
            content: 'From A', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));
        const provB = mockProvider('providerB/main', async () => ({
            content: 'From B (custom agent)', toolCalls: undefined, usage: undefined, stopReason: 'end',
        }));

        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(provA));
        factories.set('providerB', mockFactory(provB));

        const router = createModelRouter(customConfig, factories, logger);
        const result = await router.chat('custom', [{ role: 'user', content: 'hi' }], []);

        expect(result.content).toBe('From B (custom agent)');
    });

    it('lists all registered accounts', () => {
        const factories = new Map<string, ProviderFactory>();
        factories.set('providerA', mockFactory(mockProvider('a', async () => ({}))));
        factories.set('providerB', mockFactory(mockProvider('b', async () => ({}))));

        const router = createModelRouter(baseConfig, factories, logger);
        const list = router.listAccounts();

        expect(list).toHaveLength(3); // 2 providerA accounts + 1 providerB
        expect(list.map((a) => `${a.provider}/${a.account}`)).toEqual([
            'providerA/main', 'providerA/backup', 'providerB/main',
        ]);
    });
});

describe('parseModelRef', () => {
    it('parses standard model ref', async () => {
        const { parseModelRef } = await import('../src/provider.js');
        const ref = parseModelRef('anthropic/main/claude-sonnet-4-20250514');
        expect(ref.provider).toBe('anthropic');
        expect(ref.account).toBe('main');
        expect(ref.model).toBe('claude-sonnet-4-20250514');
    });

    it('handles model IDs with slashes', async () => {
        const { parseModelRef } = await import('../src/provider.js');
        const ref = parseModelRef('openai/main/gpt-4o/2024-01-01');
        expect(ref.model).toBe('gpt-4o/2024-01-01');
    });

    it('throws on invalid format', async () => {
        const { parseModelRef } = await import('../src/provider.js');
        expect(() => parseModelRef('invalid')).toThrow('Invalid model ref');
    });
});
