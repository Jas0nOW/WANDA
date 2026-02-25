// =============================================================================
// Tests — @wanda/core: Hook merging
// =============================================================================

import { describe, it, expect } from 'vitest';
import { mergeHooks } from '../src/hooks.js';
import type { LLMContext } from '@wanda/shared';

describe('mergeHooks', () => {
    it('chains onMessageReceived hooks in order', async () => {
        const order: number[] = [];

        const merged = mergeHooks(
            { onMessageReceived: async () => { order.push(1); } },
            { onMessageReceived: async () => { order.push(2); } },
        );

        await merged.onMessageReceived!({
            message: { id: '1', channelId: 'test', sender: { userId: '1', platform: 'test' }, text: 'hi', timestamp: '' },
            pairedUser: { userId: '1', platform: 'test', status: 'approved', createdAt: '' },
        });

        expect(order).toEqual([1, 2]);
    });

    it('pipes beforeLlm context through hooks', async () => {
        const merged = mergeHooks(
            {
                beforeLlm: async (ctx) => ({
                    ...ctx,
                    model: 'modified-by-hook-1',
                }),
            },
            {
                beforeLlm: async (ctx) => ({
                    ...ctx,
                    model: ctx.model + '+hook-2',
                }),
            },
        );

        const input: LLMContext = { messages: [], tools: [], model: 'default' };
        const result = await merged.beforeLlm!(input);
        expect(result.model).toBe('modified-by-hook-1+hook-2');
    });

    it('short-circuits beforeToolExec on deny', async () => {
        const secondCalled: boolean[] = [];

        const merged = mergeHooks(
            { beforeToolExec: async () => 'deny' as const },
            { beforeToolExec: async () => { secondCalled.push(true); return undefined; } },
        );

        const result = await merged.beforeToolExec!({
            toolCall: { id: '1', name: 'test', arguments: '{}' },
            parsedArgs: {},
            sender: { userId: '1', platform: 'test' },
        });

        expect(result).toBe('deny');
        expect(secondCalled).toHaveLength(0);
    });

    it('returns empty hooks when no hooks provided', () => {
        const merged = mergeHooks();
        expect(merged.onMessageReceived).toBeUndefined();
        expect(merged.beforeLlm).toBeUndefined();
    });
});
