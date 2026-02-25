import { getAnthropicAuthUrl } from './packages/providers/dist/auth/anthropic-oauth.js';
import { getOpenAIAuthUrl } from './packages/providers/dist/auth/openai-oauth.js';

console.log("ANTHROPIC:\n", getAnthropicAuthUrl().url);
getOpenAIAuthUrl().then(res => console.log("\nOPENAI:\n", res.authUrl));
