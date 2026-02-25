// Providers barrel export
export type {
    LLMProvider,
    ProviderFactory,
    ProviderAccount,
    ProviderRegistryConfig,
    ToolDefinitionForLLM,
    AuthConfig,
    ModelRef,
    AgentModelConfig,
} from './provider.js';
export { parseModelRef, serializeModelRef } from './provider.js';
export { createModelRouter, type ModelRouter } from './router.js';
export { createAnthropicFactory } from './anthropic.js';
export { createOpenAIFactory } from './openai.js';
export { createGeminiFactory } from './gemini.js';
export { createKimiFactory } from './kimi.js';
export { createGithubCopilotFactory } from './github-copilot.js';

// Auth module
export {
    createTokenManager,
    type TokenStore,
    type OAuthTokens,
    type RefreshFunction,
    getGoogleAuthUrl,
    waitForGoogleCallback,
    exchangeGoogleCode,
    createGoogleRefresher,
    defaultGoogleConfig,
    type GoogleOAuthConfig,
    requestGitHubDeviceCode,
    pollGitHubForToken,
    defaultGithubConfig,
    type GitHubOAuthConfig,
    type DeviceCodeResponse,
    getOpenAIAuthUrl,
    waitForOpenAICallback,
    exchangeOpenAICode,
    createOpenAIRefresher,
    getAnthropicAuthUrl,
    waitForAnthropicCallback,
    exchangeAnthropicCode,
    createAnthropicRefresher,
} from './auth/index.js';
