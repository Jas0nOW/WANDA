// =============================================================================
// Wanda — OpenAI OAuth (Authorization Code Flow + PKCE)
// =============================================================================
// Uses the embedded client ID from the official OpenAI Codex CLI.
// Authenticates via ChatGPT subscription — no API key needed.
// Source: https://github.com/openai/codex (open-source MIT)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import type { Logger } from '@wanda/shared';
import type { OAuthTokens, RefreshFunction } from './token-manager.js';

// Embedded from openai/codex (open-source, MIT license)
const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

const OPENAI_AUTH_BASE = 'https://auth.openai.com';
const OPENAI_AUTH_URL = `${OPENAI_AUTH_BASE}/oauth/authorize`;
const OPENAI_TOKEN_URL = `${OPENAI_AUTH_BASE}/oauth/token`;

// Dynamic port range is replaced by fixed port 1455 per user spec (codex-cli)
const REDIRECT_PORT = 1455;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/callback`;

// Strictly openid profile email offline_access as requested
const SCOPES = 'openid profile email offline_access';
const AUDIENCE = 'https://api.openai.com/v1';

// PKCE helpers
function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

export interface OpenAIAuthResult {
    authUrl: string;
    codeVerifier: string;
    redirectUri: string;
    port: number;
    state: string;
}

export async function getOpenAIAuthUrl(): Promise<OpenAIAuthResult> {
    const port = REDIRECT_PORT;
    const redirectUri = REDIRECT_URI;

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString('hex');

    const params = new URLSearchParams();
    // OpenAI Codex strict parameter order/presence
    params.set('client_id', OPENAI_CLIENT_ID);
    params.set('response_type', 'code');
    if (SCOPES) { // Only add scope if it's not empty
        params.set('scope', SCOPES);
    }
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
    params.set('redirect_uri', redirectUri);
    params.set('state', state);

    // OpenAI Auth0 is strictly expecting %20 and might 403 on +
    const queryString = params.toString().replace(/\+/g, '%20');

    return {
        authUrl: `${OPENAI_AUTH_URL}?${queryString}`,
        codeVerifier,
        redirectUri,
        port,
        state,
    };
}

/**
 * Wait for the OAuth callback on the local server.
 */
export function waitForOpenAICallback(port: number, logger: Logger, timeoutMs = 300_000, expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url ?? '/', `http://localhost:${port}`);

            if (url.pathname === '/auth/callback') {
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(errorPage(error));
                    cleanup();
                    reject(new Error(`OpenAI OAuth Fehler: ${error}`));
                    return;
                }

                if (code) {
                    const returnedState = url.searchParams.get('state');
                    if (returnedState !== expectedState) {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(errorPage('Invalid state parameter (CSRF protection failed)'));
                        cleanup();
                        reject(new Error(`OpenAI OAuth Fehler: Invalid state parameter.`));
                        return;
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(successPage('OpenAI / ChatGPT'));
                    cleanup();
                    resolve(code);
                    return;
                }
            }

            res.writeHead(404);
            res.end();
        });

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('OpenAI OAuth Timeout'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timeout);
            server.close();
        }

        server.listen(port, () => {
            logger.info({ port }, 'OpenAI OAuth callback server listening');
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            cleanup();
            reject(new Error(`OAuth server error: ${err.message}`));
        });
    });
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeOpenAICode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
): Promise<OAuthTokens> {
    const response = await fetch(OPENAI_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: OPENAI_CLIENT_ID,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            audience: AUDIENCE,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI Token-Austausch fehlgeschlagen (${response.status}): ${body}`);
    }

    const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
    };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        tokenType: data.token_type,
        scope: data.scope,
    };
}

/**
 * Create a refresh function for OpenAI tokens.
 */
export function createOpenAIRefresher(): RefreshFunction {
    return async (refreshToken: string): Promise<OAuthTokens> => {
        const response = await fetch(OPENAI_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: OPENAI_CLIENT_ID,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`OpenAI Token-Refresh fehlgeschlagen (${response.status}): ${body}`);
        }

        const data = await response.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            token_type?: string;
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? refreshToken,
            expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
            tokenType: data.token_type,
        };
    };
}

// --- HTML helpers ---

function successPage(provider: string): string {
    return `<html><body style="font-family:system-ui;text-align:center;padding:40px;background:#0d1117;color:#fff">
    <h2 style="color:#4ecca3">✅ Erfolgreich angemeldet!</h2>
    <p>Wanda hat Zugriff auf dein ${provider}-Konto erhalten.</p>
    <p style="color:#888">Du kannst dieses Fenster schließen.</p>
  </body></html>`;
}

function errorPage(error: string): string {
    return `<html><body style="font-family:system-ui;text-align:center;padding:40px;background:#0d1117;color:#fff">
    <h2 style="color:#f85149">❌ Authentifizierung fehlgeschlagen</h2>
    <p style="color:#888">Fehler: ${error}</p>
    <p>Du kannst dieses Fenster schließen und es erneut versuchen.</p>
  </body></html>`;
}
