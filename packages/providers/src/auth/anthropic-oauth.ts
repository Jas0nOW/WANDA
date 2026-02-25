// =============================================================================
// Wanda -- Anthropic Claude OAuth (Authorization Code Flow + PKCE)
// =============================================================================
// Uses the official public Claude Code CLI client ID.
// Anti-ban headers included: user-agent + anthropic-client-name.
// Source: Claude Code CLI (Anthropic, official open-source client)
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import type { Logger } from '@wanda/shared';
import type { OAuthTokens } from './token-manager.js';

// Reverse extracted from @anthropic-ai/claude-code package
const ANTHROPIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

const ANTHROPIC_AUTH_URL = 'https://claude.ai/oauth/authorize';
const ANTHROPIC_TOKEN_URL = 'https://claude.ai/oauth/token';

// Fixed port and redirect URI (consistent with known claude-code-cli registration)
const REDIRECT_PORT = 12345;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

// Exact scopes requested by the official Claude Code CLI
const SCOPES = 'user:profile user:inference user:sessions:claude_code user:mcp_servers';

// Headers that mimic the official Anthropic CLI to avoid bot-detection
const CLI_HEADERS = {
    'User-Agent': 'anthropic-cli/0.2.29',
    'anthropic-client-name': 'claude-code',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
};

// PKCE helpers
function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate the Anthropic OAuth authorization URL with PKCE.
 */
export function getAnthropicAuthUrl(): { url: string; codeVerifier: string; state: string } {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString('hex');

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: ANTHROPIC_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
    });

    if (SCOPES) {
        params.set('scope', SCOPES);
    }

    const queryString = params.toString().replace(/\+/g, '%20');

    return { url: `${ANTHROPIC_AUTH_URL}?${queryString}`, codeVerifier, state };
}

/**
 * Start local callback server on port 12345, return auth code.
 * Validates the returned state parameter to prevent CSRF.
 */
export function waitForAnthropicCallback(logger: Logger, expectedState: string, timeoutMs = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`);

            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(errorPage(error));
                    cleanup();
                    reject(new Error(`Claude OAuth Fehler: ${error}`));
                    return;
                }

                if (code) {
                    const returnedState = url.searchParams.get('state');
                    if (returnedState !== expectedState) {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(errorPage('Invalid state parameter (CSRF protection failed)'));
                        cleanup();
                        reject(new Error(`Claude OAuth Fehler: Invalid state parameter. Expected ${expectedState}, got ${returnedState}`));
                        return;
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(successPage('Anthropic Claude'));
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
            reject(new Error('Claude OAuth Timeout -- kein Callback nach 5 Minuten'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timeout);
            server.close();
        }

        server.listen(REDIRECT_PORT, () => {
            logger.info({ port: REDIRECT_PORT }, 'Anthropic OAuth callback server listening');
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                cleanup();
                reject(new Error(`Port ${REDIRECT_PORT} ist belegt. Beende andere Prozesse und versuche erneut.`));
            } else {
                cleanup();
                reject(new Error(`OAuth Server Fehler: ${err.message}`));
            }
        });
    });
}

/**
 * Exchange authorization code for tokens.
 * Uses CLI-mimicking headers to avoid Anthropic's bot filters.
 */
export async function exchangeAnthropicCode(
    code: string,
    codeVerifier: string,
): Promise<OAuthTokens> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ANTHROPIC_CLIENT_ID,
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
    });

    const response = await fetch(ANTHROPIC_TOKEN_URL, {
        method: 'POST',
        headers: CLI_HEADERS,
        body: body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Claude Token-Austausch fehlgeschlagen (${response.status}): ${text}`);
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
        expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000,
        tokenType: data.token_type ?? 'Bearer',
        scope: data.scope,
    };
}

/**
 * Create a refresh function for Anthropic tokens.
 */
export function createAnthropicRefresher() {
    return async (refreshToken: string): Promise<OAuthTokens> => {
        const response = await fetch(ANTHROPIC_TOKEN_URL, {
            method: 'POST',
            headers: CLI_HEADERS,
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: ANTHROPIC_CLIENT_ID,
                refresh_token: refreshToken,
            }).toString(),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Claude Token-Refresh fehlgeschlagen (${response.status}): ${text}`);
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
            expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000,
            tokenType: data.token_type ?? 'Bearer',
        };
    };
}

// --- HTML helpers ---

function successPage(provider: string): string {
    return `<html><body style="font-family:system-ui;text-align:center;padding:40px;background:#0d1117;color:#fff">
    <h2 style="color:#4ecca3">Erfolgreich angemeldet!</h2>
    <p>Wanda hat Zugriff auf dein ${provider}-Konto erhalten.</p>
    <p style="color:#888">Du kannst dieses Fenster schliessen.</p>
  </body></html>`;
}

function errorPage(error: string): string {
    return `<html><body style="font-family:system-ui;text-align:center;padding:40px;background:#0d1117;color:#fff">
    <h2 style="color:#f85149">Authentifizierung fehlgeschlagen</h2>
    <p style="color:#888">Fehler: ${error}</p>
    <p>Du kannst dieses Fenster schliessen und es erneut versuchen.</p>
  </body></html>`;
}
