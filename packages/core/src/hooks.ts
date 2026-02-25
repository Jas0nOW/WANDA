// =============================================================================
// Wanda — Lifecycle Hook Registry
// =============================================================================

import type { LifecycleHooks } from '@wanda/shared';

/**
 * Merge multiple hook sets into a single composite set.
 * Hooks of the same type are chained in registration order.
 */
export function mergeHooks(...hookSets: Partial<LifecycleHooks>[]): LifecycleHooks {
    const merged: LifecycleHooks = {};

    for (const hooks of hookSets) {
        if (hooks.onMessageReceived) {
            const prev = merged.onMessageReceived;
            const curr = hooks.onMessageReceived;
            merged.onMessageReceived = prev
                ? async (ctx) => { await prev(ctx); await curr(ctx); }
                : curr;
        }

        if (hooks.beforeLlm) {
            const prev = merged.beforeLlm;
            const curr = hooks.beforeLlm;
            merged.beforeLlm = prev
                ? async (ctx) => curr(await prev(ctx))
                : curr;
        }

        if (hooks.afterLlm) {
            const prev = merged.afterLlm;
            const curr = hooks.afterLlm;
            merged.afterLlm = prev
                ? async (ctx) => { await prev(ctx); await curr(ctx); }
                : curr;
        }

        if (hooks.beforeToolExec) {
            const prev = merged.beforeToolExec;
            const curr = hooks.beforeToolExec;
            merged.beforeToolExec = prev
                ? async (ctx) => {
                    const result = await prev(ctx);
                    if (result === 'deny') return 'deny';
                    return curr(ctx);
                }
                : curr;
        }

        if (hooks.afterToolExec) {
            const prev = merged.afterToolExec;
            const curr = hooks.afterToolExec;
            merged.afterToolExec = prev
                ? async (ctx) => { await prev(ctx); await curr(ctx); }
                : curr;
        }

        if (hooks.onError) {
            const prev = merged.onError;
            const curr = hooks.onError;
            merged.onError = prev
                ? async (ctx) => { await prev(ctx); await curr(ctx); }
                : curr;
        }
    }

    return merged;
}
