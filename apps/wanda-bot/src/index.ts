// =============================================================================
// Wanda — Bot Entry Point
// =============================================================================
// Boot sequence: config → logger → secrets → memory → tools → OAuth →
// providers (multi-account + fallback) → pairing → channel → start.
// Telegram commands: /login, /logout, /status, /apikey

import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { loadConfig, createLogger } from '@wanda/shared';
import { createSecretStore } from '@wanda/secrets';
import { createMemoryStore } from '@wanda/memory';
import { createToolRegistry, getCurrentTimeTool } from '@wanda/tools';
import { createPairingService, createTelegramAdapter, createWebChatAdapter } from '@wanda/channels';
import {
    createModelRouter,
    createAnthropicFactory,
    createOpenAIFactory,
    createGeminiFactory,
    createKimiFactory,
    createGithubCopilotFactory,
    createTokenManager,
    createGoogleRefresher,
    getGoogleAuthUrl,
    waitForGoogleCallback,
    exchangeGoogleCode,
    requestGitHubDeviceCode,
    pollGitHubForToken,
    type ProviderFactory,
    type GoogleOAuthConfig,
    type GitHubOAuthConfig,
    type RefreshFunction,
} from '@wanda/providers';
import { runAgentLoop } from '@wanda/core';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { buildProviderConfig } from './providers.config.js';

async function main() {
    // 1. Load config
    const config = loadConfig();
    const logger = createLogger({ level: config.logLevel, name: 'wanda' });

    logger.info('Wanda starting...');

    // 2. Ensure data directory
    if (!existsSync(config.dataDir)) {
        mkdirSync(config.dataDir, { recursive: true });
        logger.info({ dataDir: config.dataDir }, 'Created data directory');
    }

    // 3. Init secrets
    const secrets = createSecretStore(config.secretsMasterKey, config.dataDir, logger);

    // Bootstrap: store API keys from env to encrypted store (first run only)
    if (config.anthropicApiKey && !secrets.get('anthropic-key')) {
        secrets.set('anthropic-key', config.anthropicApiKey);
        logger.info('Anthropic API key bootstrapped into secret store');
    }

    // 4. Init memory
    const memory = createMemoryStore(config.dataDir, logger);

    // 5. Init tool registry
    const toolRegistry = createToolRegistry(logger);
    toolRegistry.register(getCurrentTimeTool);

    // 6. Init OAuth token manager
    const refreshers = new Map<string, RefreshFunction>();

    // Google OAuth: always register refresher using embedded Gemini CLI credentials.
    // If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set in .env, use those instead.
    const googleClientId = process.env['GOOGLE_CLIENT_ID'];
    const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    let googleOAuthConfig: GoogleOAuthConfig | undefined;

    if (googleClientId && googleClientSecret) {
        googleOAuthConfig = { clientId: googleClientId, clientSecret: googleClientSecret };
        logger.info('Google OAuth configured with custom Cloud Console credentials');
    } else {
        // Use embedded Gemini CLI credentials (safe for installed apps, no setup required)
        logger.info('Google OAuth using embedded Gemini CLI credentials (no GOOGLE_CLIENT_ID set)');
    }

    const googleRefresher = createGoogleRefresher(googleOAuthConfig);
    refreshers.set('gemini', googleRefresher);
    refreshers.set('antigravity', googleRefresher); // same credentials, same refresh

    // GitHub OAuth config from env
    const githubClientId = process.env['GITHUB_CLIENT_ID'];
    let githubOAuthConfig: GitHubOAuthConfig | undefined;

    if (githubClientId) {
        githubOAuthConfig = { clientId: githubClientId };
        logger.info('GitHub OAuth configured');
    }

    const tokenStore = createTokenManager(secrets, refreshers, logger);


    // 7. Init LLM providers (multi-provider + multi-account + OAuth)
    const providerConfig = buildProviderConfig(
        {
            anthropicApiKey: secrets.get('anthropic-key'),
            openaiApiKey: secrets.get('openai-key'),
            geminiApiKey: secrets.get('gemini-key'),
            moonshotApiKey: secrets.get('moonshot-key'),
            googleClientId,
            googleClientSecret,
            defaultModelRef: secrets.get('default-model'),
        },
        tokenStore,
    );

    // Register provider factories
    const factories = new Map<string, ProviderFactory>();
    factories.set('anthropic', createAnthropicFactory(logger));
    factories.set('openai', createOpenAIFactory(logger));
    factories.set('gemini', createGeminiFactory(logger, tokenStore));
    factories.set('kimi', createKimiFactory(logger));
    factories.set('github-copilot', createGithubCopilotFactory(logger));

    const router = createModelRouter(providerConfig, factories, logger);

    // Log available providers
    const accounts = router.listAccounts();
    if (accounts.length === 0) {
        logger.warn('No LLM providers configured. Use /login in Telegram or store API keys.');
    } else {
        logger.info({ accounts: accounts.map((a) => `${a.provider}/${a.account}`) }, 'LLM providers ready');
    }

    // 8. Init pairing
    const pairing = createPairingService(
        { dataDir: config.dataDir, adminTelegramId: config.adminTelegramId },
        logger,
    );

    // 9. Init channel
    const telegram = createTelegramAdapter(
        {
            botToken: config.botToken,
            adminTelegramId: config.adminTelegramId,
            adminTelegramChatId: config.adminTelegramChatId,
        },
        pairing,
        logger,
    );

    // Active OAuth flows (prevent concurrent logins)
    let activeOAuthFlow: string | null = null;

    // 10. Wire WebChat handler
    const resolvedPublicDir = new URL('../../../packages/channels/src/public', import.meta.url).pathname;
    logger.info({ resolvedPublicDir, importMetaUrl: import.meta.url }, 'Resolved WebChat Public Directory');

    const webchat = createWebChatAdapter(
        { port: Number(process.env['WEBCHAT_PORT'] || 3000), publicDir: resolvedPublicDir, adminId: config.adminTelegramId },
        pairing,
        logger
    );

    webchat.onMessage(async (message) => {
        logger.info({ userId: message.sender.userId, text: message.text.slice(0, 50) }, 'Inbound WebChat message');

        // Initial connection signal -> send models list and active fallback chain
        if (!message.text && !message.media?.length) {
            await webchat.sendMessage({
                channelId: 'webchat',
                recipientId: message.sender.userId,
                text: '',
                metadata: {
                    type: 'models',
                    models: router.listAccounts(),
                    agentConfig: router.getAgentConfig('default')
                }
            } as any); // We cast this to bypass strict type for now since we added custom metadata type
            return;
        }

        memory.addMessage(`webchat:${message.sender.userId}`, 'user', message.text, { channelId: message.channelId, messageId: message.id });

        const result = await runAgentLoop(message, {
            llm: router,
            tools: toolRegistry,
            pairing,
            sender: { send: (msg) => webchat.sendMessage(msg) },
            hooks: {},
            config,
            logger,
            systemPrompt: SYSTEM_PROMPT,
            agentId: 'default',
        });

        if (result.finalResponse) {
            memory.addMessage(`webchat:${message.sender.userId}`, 'assistant', result.finalResponse);
        }
    });

    // 11. Wire Telegram message handler
    telegram.onMessage(async (message) => {
        const text = message.text.trim();

        // --- /login command ---
        if (text.startsWith('/login')) {
            const provider = text.split(/\s+/)[1]?.toLowerCase();

            if (!provider) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: '📋 Verfügbare Login-Optionen:\n\n'
                        + '/login gemini — Google (OAuth, nutzt AI Pro Abo)\n'
                        + '/login github — GitHub Copilot (OAuth)\n\n'
                        + 'API Keys via:\n'
                        + '/apikey anthropic <key>\n'
                        + '/apikey openai <key>\n'
                        + '/apikey gemini <key>\n'
                        + '/apikey moonshot <key>',
                });
                return;
            }

            if (activeOAuthFlow) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: `⏳ Es läuft bereits ein Login-Vorgang für ${activeOAuthFlow}. Bitte warte.`,
                });
                return;
            }

            if (provider === 'gemini') {
                activeOAuthFlow = 'gemini';
                const { url: authUrl, codeVerifier } = getGoogleAuthUrl();

                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: `🔐 Google OAuth Login\n\nÖffne diesen Link im Browser:\n${authUrl}\n\n⏳ Warte auf Autorisierung...`,
                });

                try {
                    const code = await waitForGoogleCallback(logger);
                    const tokens = await exchangeGoogleCode(code, codeVerifier);
                    tokenStore.storeTokens('gemini', 'oauth', tokens);

                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: '✅ Google Gemini erfolgreich verbunden! 🎉\n\n'
                            + 'Dein AI Pro Abo wird jetzt für Wanda genutzt.\n'
                            + `Token gültig bis: ${new Date(tokens.expiresAt).toLocaleString('de-DE')}`,
                    });
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: `❌ Google Login fehlgeschlagen: ${errMsg}`,
                    });
                } finally {
                    activeOAuthFlow = null;
                }
                return;
            }

            if (provider === 'github') {
                if (!githubOAuthConfig) {
                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: '❌ GitHub OAuth nicht konfiguriert.\n\nSetze GITHUB_CLIENT_ID in .env',
                    });
                    return;
                }

                activeOAuthFlow = 'github';

                try {
                    const device = await requestGitHubDeviceCode(githubOAuthConfig);

                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: `🔐 GitHub Login\n\n`
                            + `1. Öffne: ${device.verificationUri}\n`
                            + `2. Gib diesen Code ein: **${device.userCode}**\n\n`
                            + `⏳ Warte auf Autorisierung... (${Math.round(device.expiresIn / 60)} Min Timeout)`,
                    });

                    const tokens = await pollGitHubForToken(
                        device.deviceCode, githubOAuthConfig, device.interval, device.expiresIn, logger,
                    );
                    tokenStore.storeTokens('github-copilot', 'oauth', tokens);

                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: '✅ GitHub Copilot erfolgreich verbunden! 🎉',
                    });
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    await telegram.sendMessage({
                        channelId: message.channelId,
                        recipientId: message.sender.userId,
                        text: `❌ GitHub Login fehlgeschlagen: ${errMsg}`,
                    });
                } finally {
                    activeOAuthFlow = null;
                }
                return;
            }

            await telegram.sendMessage({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: `❌ Unbekannter Provider: ${provider}\n\nVerfügbar: gemini, github`,
            });
            return;
        }

        // --- /apikey command ---
        if (text.startsWith('/apikey')) {
            const parts = text.split(/\s+/);
            const provider = parts[1]?.toLowerCase();
            const key = parts[2];

            if (!provider || !key) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: 'Nutzung: /apikey <provider> <key>\n\nProvider: anthropic, openai, gemini, moonshot',
                });
                return;
            }

            const keyMap: Record<string, string> = {
                anthropic: 'anthropic-key',
                openai: 'openai-key',
                gemini: 'gemini-key',
                moonshot: 'moonshot-key',
            };

            const secretId = keyMap[provider];
            if (!secretId) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: `❌ Unbekannter Provider: ${provider}\n\nVerfügbar: ${Object.keys(keyMap).join(', ')}`,
                });
                return;
            }

            secrets.set(secretId, key);
            await telegram.sendMessage({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: `✅ ${provider} API Key gespeichert (verschlüsselt).\n⚠️ Neustart nötig, damit der neue Provider aktiv wird.`,
            });
            return;
        }

        // --- /status command ---
        if (text === '/status') {
            const accts = router.listAccounts();
            const oauthEntries = tokenStore.listEntries();

            let statusText = '📊 Wanda Status\n\n';
            statusText += '**LLM Provider:**\n';
            if (accts.length === 0) {
                statusText += '  Keine konfiguriert\n';
            } else {
                for (const a of accts) {
                    statusText += `  • ${a.provider}/${a.account} (${a.models.join(', ')})\n`;
                }
            }

            statusText += '\n**OAuth Tokens:**\n';
            if (oauthEntries.length === 0) {
                statusText += '  Keine\n';
            } else {
                for (const e of oauthEntries) {
                    const exp = new Date(e.expiresAt).toLocaleString('de-DE');
                    const isValid = e.expiresAt > Date.now();
                    statusText += `  • ${e.providerId}/${e.accountId} — ${isValid ? '✅' : '❌'} (bis ${exp})\n`;
                }
            }

            await telegram.sendMessage({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: statusText,
            });
            return;
        }

        // --- /logout command ---
        if (text.startsWith('/logout')) {
            const provider = text.split(/\s+/)[1]?.toLowerCase();
            if (!provider) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: 'Nutzung: /logout <provider>\n\nProvider: gemini, github',
                });
                return;
            }

            const providerMap: Record<string, { providerId: string; accountId: string }> = {
                gemini: { providerId: 'gemini', accountId: 'oauth' },
                github: { providerId: 'github-copilot', accountId: 'oauth' },
            };

            const entry = providerMap[provider];
            if (!entry) {
                await telegram.sendMessage({
                    channelId: message.channelId,
                    recipientId: message.sender.userId,
                    text: `❌ Unbekannter Provider: ${provider}`,
                });
                return;
            }

            tokenStore.removeTokens(entry.providerId, entry.accountId);
            await telegram.sendMessage({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: `✅ ${provider} OAuth Token entfernt.`,
            });
            return;
        }

        // --- Normal message → agent loop ---
        logger.info(
            { userId: message.sender.userId, text: text.slice(0, 50) },
            'Inbound message',
        );

        // Check if any providers are available
        if (router.listAccounts().length === 0) {
            await telegram.sendMessage({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: '⚠️ Kein LLM Provider konfiguriert.\n\n'
                    + 'Nutze /login gemini oder /apikey <provider> <key> um einen Provider zu verbinden.',
            });
            return;
        }

        memory.addMessage(
            `telegram:${message.sender.userId}`,
            'user',
            text,
            { channelId: message.channelId, messageId: message.id },
        );

        const result = await runAgentLoop(message, {
            llm: router,
            tools: toolRegistry,
            pairing,
            sender: { send: (msg) => telegram.sendMessage(msg) },
            hooks: {},
            config,
            logger,
            systemPrompt: SYSTEM_PROMPT,
            agentId: 'default',
        });

        if (result.finalResponse) {
            memory.addMessage(
                `telegram:${message.sender.userId}`,
                'assistant',
                result.finalResponse,
            );
        }

        logger.info(
            { iterations: result.iterations, toolCalls: result.toolCallsTotal, abortReason: result.abortReason },
            'Agent loop completed',
        );
    });

    // 12. Start!
    await Promise.all([telegram.start(), webchat.start()]);
    logger.info('Wanda is running. Waiting for messages...');

    // Graceful shutdown
    const shutdown = async () => {
        logger.info('Shutting down...');
        await telegram.stop();
        await webchat.stop();
        memory.close();
        secrets.close();
        pairing.close();
        logger.info('Goodbye.');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', err);
    process.exit(1);
});
