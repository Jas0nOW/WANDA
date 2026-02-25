// =============================================================================
// Wanda — Google OAuth2 (Authorization Code Flow + PKCE)
// =============================================================================
// Uses the same embedded client credentials as the official Gemini CLI.
// This is safe for open-source installed applications per Google's OAuth docs:
// https://developers.google.com/identity/protocols/oauth2#installed
// (The client secret is NOT secret for installed/desktop apps.)
//
// No Google Cloud Console setup needed — just run `wanda auth login gemini`.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import type { Logger } from '@wanda/shared';
import type { OAuthTokens, RefreshFunction } from './token-manager.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REDIRECT_PORT = 8247;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

// Embedded credentials from open-source Gemini CLI (google-gemini/gemini-cli)
// Safe to embed: installed apps don't have a confidential client secret.
// Embedded credentials from environment variables or safe defaults (if provided via env)
const GEMINI_CLIENT_ID = process.env.GEMINI_CLIENT_ID || '';
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLIENT_SECRET || '';

// Scopes for Gemini / Google AI access
// Note: 'generative-language' scopes are often blocked for Desktop OAuth. cloud-platform covers Vertex AI.
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
}

// Default config (no env vars needed)
export const defaultGoogleConfig: GoogleOAuthConfig = {
    clientId: GEMINI_CLIENT_ID,
    clientSecret: GEMINI_CLIENT_SECRET,
};

// PKCE helpers
function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate the Google OAuth authorization URL with PKCE.
 */
export function getGoogleAuthUrl(
    config: GoogleOAuthConfig = defaultGoogleConfig,
): { url: string; codeVerifier: string } {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        include_granted_scopes: 'true',
    });
    return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, codeVerifier };
}

/**
 * Start a temporary local HTTP server to capture the OAuth callback.
 * Returns a promise that resolves with the authorization code.
 */
export function waitForGoogleCallback(logger: Logger, timeoutMs = 300_000): Promise<string> {
    return new Promise((resolve, reject) => {
        const server = createServer((req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`);

            if (url.pathname === '/callback') {
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:40px;background:#1a1a2e;color:#fff">
              <h2>❌ Authentifizierung fehlgeschlagen</h2>
              <p style="color:#aaa">Fehler: ${error}</p>
              <p>Du kannst dieses Fenster schließen.</p>
            </body></html>
          `);
                    cleanup();
                    reject(new Error(`Google OAuth error: ${error}`));
                    return;
                }

                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:40px;background:#1a1a2e;color:#fff">
              <h2 style="color:#4ecca3">✅ Erfolgreich angemeldet!</h2>
              <p>Wanda hat Zugriff auf dein Google-Konto.</p>
              <p style="color:#aaa">Du kannst dieses Fenster schließen.</p>
            </body></html>
          `);
                    cleanup();
                    resolve(code);
                    return;
                }
            }

            res.writeHead(404);
            res.end('Not found');
        });

        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('OAuth Timeout — kein Callback nach 5 Minuten'));
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timeout);
            server.close();
        }

        server.listen(REDIRECT_PORT, () => {
            logger.info({ port: REDIRECT_PORT }, 'OAuth callback server listening');
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                cleanup();
                reject(new Error(`Port ${REDIRECT_PORT} ist belegt. Beende andere Prozesse und versuche es erneut.`));
            } else {
                cleanup();
                reject(new Error(`OAuth callback server: ${err.message}`));
            }
        });
    });
}

/**
 * Exchange authorization code for tokens (with PKCE verifier).
 */
export async function exchangeGoogleCode(
    code: string,
    codeVerifier: string,
    config: GoogleOAuthConfig = defaultGoogleConfig,
): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Google Token-Austausch fehlgeschlagen (${response.status}): ${body}`);
    }

    const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope?: string;
    };

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: data.token_type,
        scope: data.scope,
    };
}

/**
 * Create a refresh function for Google OAuth tokens.
 */
export function createGoogleRefresher(config: GoogleOAuthConfig = defaultGoogleConfig): RefreshFunction {
    return async (refreshToken: string): Promise<OAuthTokens> => {
        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                grant_type: 'refresh_token',
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Google Token-Refresh fehlgeschlagen (${response.status}): ${body}`);
        }

        const data = await response.json() as {
            access_token: string;
            expires_in: number;
            token_type: string;
            scope?: string;
        };

        return {
            accessToken: data.access_token,
            refreshToken, // Google doesn't return a new refresh token
            expiresAt: Date.now() + data.expires_in * 1000,
            tokenType: data.token_type,
            scope: data.scope,
        };
    };
}
