// =============================================================================
// Wanda — GitHub Copilot Provider
// =============================================================================
// OpenAI-compatible API via GitHub Copilot endpoint. Auth: OAuth token.

import type { Logger } from '@wanda/shared';
import type { ProviderAccount, ProviderFactory } from './provider.js';
import { createOpenAIFactory } from './openai.js';

const COPILOT_BASE_URL = 'https://api.githubcopilot.com';

export function createGithubCopilotFactory(logger: Logger): ProviderFactory {
    const openaiFactory = createOpenAIFactory(logger);

    return (account: ProviderAccount) => {
        const copilotAccount: ProviderAccount = {
            ...account,
            baseUrl: account.baseUrl ?? COPILOT_BASE_URL,
        };

        const provider = openaiFactory(copilotAccount);

        return {
            ...provider,
            id: `github-copilot/${account.id}`,
        };
    };
}
