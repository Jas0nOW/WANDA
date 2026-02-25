// =============================================================================
// Wanda — Kimi (Moonshot) Provider
// =============================================================================
// OpenAI-compatible API at api.moonshot.ai/v1. Reuses OpenAI adapter.

import type { Logger } from '@wanda/shared';
import type { ProviderAccount, ProviderFactory } from './provider.js';
import { createOpenAIFactory } from './openai.js';

const KIMI_BASE_URL = 'https://api.moonshot.ai/v1';

export function createKimiFactory(logger: Logger): ProviderFactory {
    const openaiFactory = createOpenAIFactory(logger);

    return (account: ProviderAccount) => {
        // Force Kimi base URL unless account overrides
        const kimiAccount: ProviderAccount = {
            ...account,
            baseUrl: account.baseUrl ?? KIMI_BASE_URL,
        };

        const provider = openaiFactory(kimiAccount);

        return {
            ...provider,
            id: `kimi/${account.id}`,
        };
    };
}
