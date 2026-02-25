// Wanda CLI Entry Point
// All OAuth providers work out-of-the-box -- no extra setup needed.

import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { loadCliConfig, createLogger } from '@wanda/shared';
import { createSecretStore } from '@wanda/secrets';
import {
    createTokenManager,
    createGoogleRefresher,
    createOpenAIRefresher,
    createAnthropicRefresher,
    getGoogleAuthUrl,
    waitForGoogleCallback,
    exchangeGoogleCode,
    getOpenAIAuthUrl,
    waitForOpenAICallback,
    exchangeOpenAICode,
    getAnthropicAuthUrl,
    waitForAnthropicCallback,
    exchangeAnthropicCode,
    requestGitHubDeviceCode,
    pollGitHubForToken,
    type RefreshFunction,
} from '@wanda/providers';

// Helpers

function openBrowser(url: string): boolean {
    try {
        execSync(`xdg-open "${url}" 2>/dev/null || open "${url}" 2>/dev/null`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function printHeader() {
    console.log('');
    console.log('  Wanda Agent System');
    console.log('  ------------------');
    console.log('');
}

function printHelp() {
    printHeader();
    console.log('  Browser-Login (Zero-Setup):');
    console.log('    wanda auth login gemini       Google OAuth (Gemini + Antigravity)');
    console.log('    wanda auth login openai       OpenAI Codex OAuth (Port 1455)');
    console.log('    wanda auth login anthropic    Claude Code OAuth (Port 12345)');
    console.log('    wanda auth login github       GitHub Copilot (Device Flow)');
    console.log('    wanda auth login antigravity  Alias fuer gemini');
    console.log('');
    console.log('  API Key Fallback/Andere:');
    console.log('    wanda auth login kimi         Kimi/Moonshot API Key');
    console.log('');
    console.log('  Verwaltung:');
    console.log('    wanda auth status             Alle Auth-Status anzeigen');
    console.log('    wanda auth logout <provider>  Token/Key entfernen');
    console.log('    wanda apikey set <prov> <key> API Key direkt speichern');
    console.log('    wanda apikey list             Gespeicherte Keys');
    console.log('');
    console.log('  System:');
    console.log('    wanda status                  System-Uebersicht');
    console.log('    wanda doctor                  Checkt Abhänigkeiten, Keys & Tokens');
    console.log('    wanda doctor --fix            Checkt und behebt WebChat-Port-Konflikte');
    console.log('    wanda update                  Wanda System & Deps aktualisieren');
    console.log('    wanda start                   Bot starten');
    console.log('    wanda kill                    Beendet blockierende Wanda/Node Prozesse + WebChat-Port');
    console.log('');
    console.log('  Testing & Model Selection:');
    console.log('    wanda model select <ref>      Standard-Model setzen (z.B. openai/main/gpt-4o)');
    console.log('    wanda test telegram <text>    Sendet Testnachricht an Admin');
    console.log('    wanda test model <text>       Testet die aktuelle LLM-Kette');
    console.log('');
}

function getWebchatPort(): number {
    const raw = Number(process.env['WEBCHAT_PORT'] ?? 3000);
    return Number.isInteger(raw) && raw > 0 ? raw : 3000;
}

function getRunningWandaPids(): number[] {
    try {
        const out = execSync('pgrep -f "/Wanda-Repo/apps/wanda-bot/src/index\\.(ts|js)" || true', { stdio: 'pipe' })
            .toString()
            .trim();
        if (!out) return [];
        return out
            .split('\n')
            .map((pid) => Number(pid.trim()))
            .filter((pid) => Number.isInteger(pid) && pid > 0);
    } catch {
        return [];
    }
}

// Bootstrap

function bootstrap() {
    const config = loadCliConfig();
    const logger = createLogger({ level: 'silent', name: 'wanda-cli' });

    if (!existsSync(config.dataDir)) {
        mkdirSync(config.dataDir, { recursive: true });
    }

    const secrets = createSecretStore(config.secretsMasterKey, config.dataDir, logger);

    const refreshers = new Map<string, RefreshFunction>();
    refreshers.set('gemini', createGoogleRefresher());
    refreshers.set('antigravity', createGoogleRefresher());
    refreshers.set('openai', createOpenAIRefresher());
    refreshers.set('anthropic', createAnthropicRefresher());

    const tokenStore = createTokenManager(secrets, refreshers, logger);
    return { logger, secrets, tokenStore };
}

// User Inputs

function prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}

// Commands

async function cmdStart() {
    const runningPids = getRunningWandaPids();
    if (runningPids.length > 0) {
        printHeader();
        console.log('  ⚠️ Wanda scheint bereits lokal zu laufen.');
        console.log(`  Gefundene PID(s): ${runningPids.join(', ')}`);
        console.log('  Nutze zuerst `wanda kill` oder stoppe den bestehenden Prozess.');
        console.log('');
        return;
    }

    console.log('  Starting Wanda Bot...');
    console.log('');
    const { fork } = await import('node:child_process');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const indexPath = join(__dirname, 'index.js');

    while (true) {
        await new Promise<void>((resolve) => {
            const child = fork(indexPath, [], {
                stdio: 'inherit',
                env: process.env
            });

            child.on('exit', (code) => {
                if (code === 0 || code === 2) {
                    console.log('\\n  🔄 Restarting Wanda Gateway...\\n');
                    setTimeout(resolve, 1000); // 1s cooldown before restart
                } else {
                    console.log(`\\n  ❌ Process exited with code ${code}. Stopping.`);
                    process.exit(code || 1);
                }
            });

            child.on('error', (err) => {
                console.error('  ❌ Failed to start process:', err);
                process.exit(1);
            });
        });
    }
}

async function cmdKill() {
    const webchatPort = getWebchatPort();
    printHeader();
    console.log('  💥 Beende alle blockierenden Wanda-Prozesse...');
    console.log('');
    try {
        // 1. Kill everything on configured webchat port specifically
        try {
            const pids = execSync(`lsof -t -i:${webchatPort} 2>/dev/null`).toString().trim();
            if (pids) {
                execSync(`kill -9 ${pids.split('\\n').join(' ')} 2>/dev/null`);
            }
        } catch { }

        // 2. Fallback kill by process name (wanda, tsx, node running wanda)
        execSync('pkill -9 -f "wanda-bot/src/index" || true', { stdio: 'ignore' });
        execSync('pkill -9 -f "wanda/bot" || true', { stdio: 'ignore' });
        execSync(`fuser -k -9 ${webchatPort}/tcp || true`, { stdio: 'ignore' });

        console.log(`  ✅ Alle Wanda-Prozesse und Port ${webchatPort} wurden beendet.`);
    } catch {
        console.log('  ⚠️ Fehler beim Beenden einiger Prozesse.');
    }
    console.log('');
}

async function cmdDoctor(fix = false) {
    const webchatPort = getWebchatPort();
    printHeader();
    console.log(`  🏥 Wanda Doctor - System Check${fix ? ' (Auto-Fix)' : ''}`);
    console.log('');

    if (fix) {
        console.log('  [Auto-Fix]');
        console.log(`  Beende blockierende Prozesse auf WebChat-Port ${webchatPort}...`);
        try {
            execSync(`fuser -k -9 ${webchatPort}/tcp || true`, { stdio: 'ignore' });
            execSync('pkill -9 -f "wanda/bot" || true', { stdio: 'ignore' });
            console.log(`  ✅ Port ${webchatPort} bereinigt.`);
        } catch { }
        console.log('');
    }

    const checks = [
        { name: 'Node.js', cmd: 'node -v', pass: 'System' },
        { name: 'pnpm', cmd: 'pnpm -v', pass: 'System' },
        { name: 'Git', cmd: 'git --version', pass: 'System' },
    ];

    console.log('  [System Abhängigkeiten]');
    for (const check of checks) {
        try {
            const out = execSync(check.cmd, { stdio: 'pipe' }).toString().trim();
            console.log(`  ✅ ${check.name.padEnd(10)}: ${out}`);
        } catch {
            console.log(`  ❌ ${check.name.padEnd(10)}: Nicht gefunden oder defekt!`);
        }
    }
    console.log('');

    console.log('  [Authentifizierung]');
    const { secrets, tokenStore } = bootstrap();
    const tokens = tokenStore.listEntries();
    const keys = secrets.list().filter(k => k.endsWith('-key'));

    console.log(`  🔑 OAuth Tokens: ${tokens.length}`);
    for (const t of tokens) {
        const valid = t.expiresAt > Date.now();
        console.log(`    ${valid ? '✅' : '⚠️'} ${t.providerId} (${valid ? 'Valide' : 'Abgelaufen'})`);
    }

    console.log(`  🔐 API Keys: ${keys.length}`);
    for (const k of keys) {
        console.log(`    ✅ ${k}`);
    }

    console.log('');
    console.log('  [Bot Konfiguration]');
    if (process.env.TELEGRAM_BOT_TOKEN) {
        console.log('  ✅ TELEGRAM_BOT_TOKEN ist gesetzt');
    } else {
        console.log('  ⚠️ TELEGRAM_BOT_TOKEN fehlt in der .env');
    }

    if (process.env.TELEGRAM_ALLOWED_USERS) {
        console.log(`  ✅ TELEGRAM_ALLOWED_USERS: ${process.env.TELEGRAM_ALLOWED_USERS}`);
    } else {
        console.log('  ⚠️ TELEGRAM_ALLOWED_USERS fehlt in der .env');
    }

    secrets.close();
    console.log('');
    console.log('  Doctor Lauf beendet.');
    console.log('');
}

async function cmdUpdate() {
    printHeader();
    console.log('  🚀 Updating Wanda...');
    console.log('');
    try {
        console.log('  1. Git Pull...');
        execSync('git pull --rebase', { stdio: 'inherit' });
        console.log('');
        console.log('  2. Installiere Abhängigkeiten (pnpm install)...');
        execSync('pnpm install', { stdio: 'inherit' });
        console.log('');
        console.log('  3. Typecheck...');
        execSync('pnpm -r typecheck', { stdio: 'inherit' });
        console.log('');
        console.log('  ✅ Wanda erfolgreich aktualisiert!');
    } catch {
        console.log('');
        console.log('  ❌ Fehler beim Update.');
    }
    console.log('');
}

async function executeOAuthFlow(
    providerName: string,
    logger: any,
    getAuthUrl: () => Promise<{ url?: string, authUrl?: string, codeVerifier: string, redirectUri?: string, port?: number, state?: string }> | { url?: string, authUrl?: string, codeVerifier: string, redirectUri?: string, port?: number, state?: string },
    waitCb: (logger: any, timeout: number, authData: any) => Promise<string>,
    exchangeCode: (code: string, verifier: string, redirectUri?: string) => Promise<any>,
    storeTokens: (tokens: any) => void
) {
    const authData = await getAuthUrl();
    const urlString = authData.url || authData.authUrl;
    if (!urlString) throw new Error("Auth URL konnte nicht generiert werden");

    const browserOpened = openBrowser(urlString);

    if (browserOpened) {
        console.log(`  Browser geoeffnet -- bitte bei ${providerName} anmelden.`);
    } else {
        console.log('  Oeffne diesen Link im Browser:');
        console.log('');
        console.log(`  ${urlString}`);
    }

    console.log('');
    console.log('  Warte auf Autorisierung...');

    // Allow manual URL paste fallback for all browser oauth flows just in case local server gets blocked
    let resolved = false;

    const serverPromise = waitCb(logger, 300_000, authData).then((code) => {
        resolved = true;
        return code;
    });

    const manualPromise = (async () => {
        await new Promise((r) => setTimeout(r, 1500));
        while (!resolved) {
            const input = await prompt('  (Falls Browser nicht umleitet: Callback-URL hier einfuegen / Enter zum Warten): ');
            if (resolved) return '';
            if (!input) continue;
            try {
                const u = new URL(input);
                const code = u.searchParams.get('code');
                if (code) { resolved = true; return code; }
                console.log('  Kein Code in URL. Nochmal versuchen.');
            } catch {
                if (input.length > 10) { resolved = true; return input; }
            }
        }
        return '';
    })();

    const code = await Promise.race([serverPromise, manualPromise]);

    if (!code) {
        throw new Error('Kein Auth-Code erhalten.');
    }

    console.log('  Token wird abgerufen...');

    const tokens = await exchangeCode(code, authData.codeVerifier, authData.redirectUri);
    storeTokens(tokens);

    console.log('');
    console.log(`  ✅ ${providerName} erfolgreich verbunden!`);
    console.log(`  Token gueltig bis: ${new Date(tokens.expiresAt).toLocaleString('de-DE')}`);
    console.log('  Auto-Refresh aktiv.');
    console.log('');
}

async function cmdAuthLoginGoogle() {
    const { logger, secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  Google OAuth Login (Gemini / Antigravity)');
    console.log('');

    try {
        await executeOAuthFlow('Google', logger, getGoogleAuthUrl,
            (l, timeout, _authData) => waitForGoogleCallback(l, timeout),
            (code, verifier) => exchangeGoogleCode(code, verifier),
            (tokens) => {
                tokenStore.storeTokens('gemini', 'oauth', tokens);
                tokenStore.storeTokens('antigravity', 'oauth', tokens);
            }
        );
    } catch (err) {
        console.log(`  Fehler: ${err instanceof Error ? err.message : err}`);
    }

    secrets.close();
}

async function cmdAuthLoginOpenAI() {
    const { logger, secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  OpenAI / Codex OAuth Login (Port 1455)');
    console.log('');

    try {
        await executeOAuthFlow('OpenAI', logger,
            async () => {
                const { authUrl, codeVerifier, redirectUri, state } = await getOpenAIAuthUrl() as any;
                return { authUrl, codeVerifier, redirectUri, state };
            },
            // Hack to cast wait callback since OpenAICallback takes 3 args (port, logger, timeout)
            // But we hardcoded port 1455 inside wait cb now. Wait, openai-oauth expects port!
            // Actually, we made a tiny mistake in the interface in openai-oauth.ts? We kept port. Oh well.
            (l, timeout, authData) => waitForOpenAICallback(1455, l, timeout, authData.state),
            (code, verifier, redirectUri) => exchangeOpenAICode(code, verifier, redirectUri as string),
            (tokens) => {
                tokenStore.storeTokens('openai', 'oauth', tokens);
            }
        );
    } catch (err) {
        console.log(`  Fehler: ${err instanceof Error ? err.message : err}`);
    }

    secrets.close();
}

async function cmdAuthLoginAnthropic() {
    const { logger, secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  Anthropic / Claude Code OAuth Login (Port 12345)');
    console.log('');

    try {
        await executeOAuthFlow('Anthropic', logger, getAnthropicAuthUrl,
            (l, timeout, authData) => waitForAnthropicCallback(l, authData.state, timeout),
            (code, verifier) => exchangeAnthropicCode(code, verifier),
            (tokens) => {
                tokenStore.storeTokens('anthropic', 'oauth', tokens);
            }
        );
    } catch (err) {
        console.log(`  Fehler: ${err instanceof Error ? err.message : err}`);
    }

    secrets.close();
}

async function cmdAuthLoginGitHub() {
    const { logger, secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  GitHub Copilot OAuth Login (Device Flow)');
    console.log('');

    try {
        const device = await requestGitHubDeviceCode();
        openBrowser(device.verificationUriComplete ?? device.verificationUri);

        console.log(`  1. Browser oeffnet: ${device.verificationUri}`);
        console.log(`  2. Code eingeben:   ${device.userCode}`);
        console.log('');
        console.log(`  Warte auf Autorisierung... (${Math.round(device.expiresIn / 60)} Min)`);

        const tokens = await pollGitHubForToken(
            device.deviceCode, undefined, device.interval, device.expiresIn, logger,
        );
        tokenStore.storeTokens('github-copilot', 'oauth', tokens);

        console.log('');
        console.log('  ✅ GitHub Copilot erfolgreich verbunden!');
        console.log('');
    } catch (err) {
        console.log(`  Fehler: ${err instanceof Error ? err.message : err}`);
    }

    secrets.close();
}

async function cmdAuthLoginApiKey(provider: string) {
    const { secrets } = bootstrap();

    const info: Record<string, { name: string; secretId: string; hint: string }> = {
        kimi: {
            name: 'Kimi / Moonshot',
            secretId: 'moonshot-key',
            hint: 'API Key: https://platform.moonshot.cn/console/api-keys',
        },
    };

    const p = info[provider];
    if (!p) {
        console.log(`  Unbekannter Provider: ${provider}`);
        secrets.close();
        return;
    }

    printHeader();
    console.log(`  ${p.name} API Key / Token`);
    console.log('');
    console.log(`  ${p.hint}`);
    console.log('');

    const key = await prompt('  API Key (oder Token) eingeben: ');

    if (!key || key.length < 10) {
        console.log('  Ungueltiger Key.');
        secrets.close();
        return;
    }

    secrets.set(p.secretId, key);
    console.log('');
    console.log(`  ✅ ${p.name} Token/Key gespeichert (AES-256-GCM verschluesselt).`);
    console.log('');
    secrets.close();
}

function cmdAuthStatus() {
    const { secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  Auth-Status');
    console.log('');

    const labels: Record<string, string> = {
        'gemini': 'Google Gemini',
        'antigravity': 'Antigravity (Google)',
        'openai': 'OpenAI Codex',
        'anthropic': 'Anthropic (Claude Code)',
        'github-copilot': 'GitHub Copilot',
    };

    console.log('  OAuth Tokens:');
    const entries = tokenStore.listEntries();
    if (entries.length === 0) {
        console.log('    Keine\n');
    } else {
        for (const e of entries) {
            const label = labels[e.providerId] ?? e.providerId;
            const exp = new Date(e.expiresAt).toLocaleString('de-DE');
            const valid = e.expiresAt > Date.now();
            console.log(`    ${valid ? '[OK]' : '[EXP]'} ${label} -- bis ${exp}`);
        }
        console.log('');
    }

    console.log('  API Keys / Manuelle Tokens:');
    const keyLabels: Record<string, string> = {
        'anthropic-key': 'Anthropic',
        'openai-key': 'OpenAI (API Key)',
        'gemini-key': 'Gemini (API Key)',
        'moonshot-key': 'Kimi / Moonshot',
    };
    const allKeys = secrets.list().filter((s) => s.endsWith('-key'));
    if (allKeys.length === 0) {
        console.log('    Keine\n');
    } else {
        for (const k of allKeys) console.log(`    [KEY] ${keyLabels[k] ?? k}`);
        console.log('');
    }

    secrets.close();
}

function cmdAuthLogout(provider: string) {
    const { secrets, tokenStore } = bootstrap();

    const oauthMap: Record<string, Array<{ providerId: string; accountId: string }>> = {
        gemini: [{ providerId: 'gemini', accountId: 'oauth' }, { providerId: 'antigravity', accountId: 'oauth' }],
        antigravity: [{ providerId: 'gemini', accountId: 'oauth' }, { providerId: 'antigravity', accountId: 'oauth' }],
        openai: [{ providerId: 'openai', accountId: 'oauth' }],
        anthropic: [{ providerId: 'anthropic', accountId: 'oauth' }],
        github: [{ providerId: 'github-copilot', accountId: 'oauth' }],
    };

    const keyMap: Record<string, string> = {
        kimi: 'moonshot-key',
    };

    const oauthEntries = oauthMap[provider];
    const keyId = keyMap[provider];

    if (!oauthEntries && !keyId) {
        console.log(`  Unbekannter Provider: ${provider}`);
        console.log('  Verfuegbar: gemini, antigravity, openai, github, anthropic, kimi');
        secrets.close();
        return;
    }

    if (oauthEntries) {
        for (const e of oauthEntries) tokenStore.removeTokens(e.providerId, e.accountId);
    }
    if (keyId) secrets.delete(keyId);

    console.log(`  ${provider} -- Auth entfernt.`);
    secrets.close();
}

function cmdApikeySet(provider: string, key: string) {
    const { secrets } = bootstrap();

    const keyMap: Record<string, string> = {
        anthropic: 'anthropic-key',
        openai: 'openai-key',
        gemini: 'gemini-key',
        kimi: 'moonshot-key',
        moonshot: 'moonshot-key',
    };

    const secretId = keyMap[provider];
    if (!secretId) {
        console.log(`  Unbekannter Provider: ${provider}`);
        console.log(`  Verfuegbar: ${Object.keys(keyMap).join(', ')}`);
        secrets.close();
        return;
    }

    secrets.set(secretId, key);
    console.log(`  ${provider} API Key gespeichert.`);
    secrets.close();
}

function cmdApikeyList() {
    const { secrets } = bootstrap();
    printHeader();
    console.log('  Gespeicherte API Keys:');
    console.log('');
    const keys = secrets.list().filter((s) => s.endsWith('-key'));
    if (keys.length === 0) {
        console.log('  Keine. Nutze: wanda auth login <provider>');
    } else {
        for (const k of keys) console.log(`  * ${k}`);
    }
    console.log('');
    secrets.close();
}

function cmdStatus() {
    const { secrets, tokenStore } = bootstrap();
    printHeader();
    console.log('  System-Status');
    console.log('');

    const entries = tokenStore.listEntries();
    console.log('  OAuth:');
    if (entries.length === 0) {
        console.log('    Keine Tokens');
    } else {
        for (const e of entries) {
            console.log(`    ${e.expiresAt > Date.now() ? '[OK]' : '[EXP]'} ${e.providerId}/${e.accountId}`);
        }
    }

    const keys = secrets.list().filter((s) => s.endsWith('-key'));
    console.log('  API Keys:');
    if (keys.length === 0) {
        console.log('    Keine');
    } else {
        for (const k of keys) console.log(`    [KEY] ${k}`);
    }

    console.log('');
    secrets.close();
}

function cmdModelSelect(modelRef: string) {
    const { secrets } = bootstrap();
    secrets.set('default-model', modelRef);
    printHeader();
    console.log(`  ✅ Standard-Modell fuer Wanda gesetzt auf: ${modelRef}`);
    console.log('  (Wanda nutzt dieses Modell nun bevorzugt)');
    console.log('');
    secrets.close();
}

async function cmdTestTelegram(text: string) {
    printHeader();
    const botToken = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_ADMIN_CHAT_ID'] || process.env['TELEGRAM_ALLOWED_USERS']?.split(',')[0];

    if (!botToken || !chatId) {
        console.log('  ❌ Bitte TELEGRAM_BOT_TOKEN und TELEGRAM_ALLOWED_USERS in .env setzen.');
        return;
    }
    console.log('  Sende Testnachricht via Telegram...');
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `🧪 *Wanda CLI Test*\n\n${text}`, parse_mode: 'Markdown' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
        console.log('  ✅ Nachricht erfolgreich versendet!');
    } catch (err) {
        console.log(`  ❌ Senden fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log('');
}

async function cmdTestModel(text: string) {
    printHeader();
    console.log(`  Starte Modell-Test mit Prompt: "${text}"`);
    console.log('  Konfiguriere Router (Auto-Fallback)...');

    const { logger, secrets, tokenStore } = bootstrap();
    const {
        createModelRouter, createAnthropicFactory, createOpenAIFactory,
        createGeminiFactory, createKimiFactory, createGithubCopilotFactory
    } = await import('@wanda/providers');
    const { buildProviderConfig } = await import('./providers.config.js');

    const providerConfig = buildProviderConfig({
        anthropicApiKey: secrets.get('anthropic-key'),
        openaiApiKey: secrets.get('openai-key'),
        geminiApiKey: secrets.get('gemini-key'),
        moonshotApiKey: secrets.get('moonshot-key'),
        googleClientId: process.env['GOOGLE_CLIENT_ID'],
        googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'],
        defaultModelRef: secrets.get('default-model'),
    }, tokenStore);

    const factories = new Map();
    factories.set('anthropic', createAnthropicFactory(logger));
    factories.set('openai', createOpenAIFactory(logger));
    factories.set('gemini', createGeminiFactory(logger, tokenStore));
    factories.set('kimi', createKimiFactory(logger));
    factories.set('github-copilot', createGithubCopilotFactory(logger));

    const router = createModelRouter(providerConfig, factories, logger);
    const primary = providerConfig.agents['default']?.primary ?? 'unknown';

    console.log(`  Primäres Modell konfiguriert als: ${primary}`);
    console.log('  Sende Anfrage...');

    try {
        const result = await router.chat('default', [{ role: 'user', content: text }], []);
        console.log('');
        console.log('  🤖 Antwort:');
        console.log(`  ${result.content}`);
        console.log('');
    } catch (err) {
        console.log(`  ❌ Anfrage fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }

    secrets.close();
}

// Main

async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const [cmd, sub, arg1, arg2] = args;

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        printHelp();
        return;
    }

    if (cmd === 'start') { await cmdStart(); return; }
    if (cmd === 'doctor') { await cmdDoctor(sub === '--fix'); return; }
    if (cmd === 'kill') { await cmdKill(); return; }
    if (cmd === 'update') { await cmdUpdate(); return; }

    if (cmd === 'auth') {
        if (sub === 'login') {
            const prov = arg1?.toLowerCase();
            if (!prov) {
                console.log('  Nutzung: wanda auth login <gemini|openai|anthropic|github|kimi>');
                return;
            }
            if (prov === 'gemini' || prov === 'antigravity') { await cmdAuthLoginGoogle(); }
            else if (prov === 'github') { await cmdAuthLoginGitHub(); }
            else if (prov === 'openai') { await cmdAuthLoginOpenAI(); }
            else if (prov === 'anthropic') { await cmdAuthLoginAnthropic(); }
            else if (prov === 'kimi') { await cmdAuthLoginApiKey(prov); }
            else { console.log(`  Unbekannter Provider: ${prov}`); printHelp(); }
        } else if (sub === 'status') {
            cmdAuthStatus();
        } else if (sub === 'logout' && arg1) {
            cmdAuthLogout(arg1);
        } else {
            console.log('  Nutzung: wanda auth <login|status|logout> ...');
        }
        return;
    }

    if (cmd === 'apikey') {
        if (sub === 'set' && arg1 && arg2) { cmdApikeySet(arg1, arg2); }
        else if (sub === 'list') { cmdApikeyList(); }
        else { console.log('  Nutzung: wanda apikey <set <prov> <key> | list>'); }
        return;
    }

    if (cmd === 'model' && sub === 'select' && arg1) { cmdModelSelect(arg1); return; }
    if (cmd === 'test') {
        if (sub === 'telegram' && arg1) { await cmdTestTelegram(args.slice(2).join(' ')); return; }
        if (sub === 'model' && arg1) { await cmdTestModel(args.slice(2).join(' ')); return; }
        console.log('  Nutzung: wanda test <telegram|model> <text>');
        return;
    }

    if (cmd === 'status') { cmdStatus(); return; }

    console.log(`  Unbekannter Befehl: ${cmd}`);
    printHelp();
}

main().catch((err) => {
    console.error('  Fehler:', err instanceof Error ? err.message : err);
    process.exit(1);
});
