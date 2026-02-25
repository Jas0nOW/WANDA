// =============================================================================
// Wanda — GitHub OAuth (Device Authorization Flow)
// =============================================================================
// Uses the same embedded client ID as the official VS Code Copilot Chat extension.
// No GitHub App registration needed — works with any GitHub Copilot subscription.
//
// Run: `wanda auth login github`

import type { Logger } from '@wanda/shared';
import type { OAuthTokens } from './token-manager.js';

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Embedded client ID from VS Code Copilot Chat (open-source extension)
const GITHUB_COPILOT_CLIENT_ID = 'Iv1.b507a08c87ecfe98';

// Scopes needed for Copilot API access
const SCOPES = 'copilot user:email read:user';

export interface GitHubOAuthConfig {
    clientId: string;
}

export const defaultGithubConfig: GitHubOAuthConfig = {
    clientId: GITHUB_COPILOT_CLIENT_ID,
};

export interface DeviceCodeResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
}

/**
 * Request a device code from GitHub.
 * Returns the user code and verification URL to show the user.
 */
export async function requestGitHubDeviceCode(
    config: GitHubOAuthConfig = defaultGithubConfig,
): Promise<DeviceCodeResponse> {
    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: config.clientId,
            scope: SCOPES,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub Device Code Request fehlgeschlagen (${response.status}): ${body}`);
    }

    const data = await response.json() as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        verification_uri_complete?: string;
        expires_in: number;
        interval: number;
    };

    return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        verificationUriComplete: data.verification_uri_complete ?? data.verification_uri,
        expiresIn: data.expires_in,
        interval: data.interval,
    };
}

/**
 * Poll GitHub for the access token after the user has authorized.
 * Resolves when authorized, rejects on timeout or denial.
 */
export async function pollGitHubForToken(
    deviceCode: string,
    config: GitHubOAuthConfig = defaultGithubConfig,
    intervalSec: number,
    expiresIn: number,
    logger: Logger,
): Promise<OAuthTokens> {
    const deadline = Date.now() + expiresIn * 1000;
    let pollInterval = Math.max(intervalSec, 5) * 1000;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        const response = await fetch(GITHUB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: config.clientId,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            }),
        });

        const data = await response.json() as {
            access_token?: string;
            token_type?: string;
            scope?: string;
            error?: string;
            error_description?: string;
            interval?: number;
        };

        if (data.access_token) {
            return {
                accessToken: data.access_token,
                // GitHub PATs don't expire (set to 1 year)
                expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
                tokenType: data.token_type,
                scope: data.scope,
            };
        }

        switch (data.error) {
            case 'authorization_pending':
                logger.debug('GitHub OAuth: warte auf Benutzer-Autorisierung...');
                break;
            case 'slow_down':
                if (data.interval) pollInterval = (data.interval + 5) * 1000;
                else pollInterval += 5000;
                break;
            case 'expired_token':
                throw new Error('GitHub Code abgelaufen. Bitte nochmal: wanda auth login github');
            case 'access_denied':
                throw new Error('GitHub Autorisierung verweigert.');
            default:
                throw new Error(`GitHub OAuth Fehler: ${data.error} — ${data.error_description}`);
        }
    }

    throw new Error('GitHub Code abgelaufen (Timeout). Bitte nochmal: wanda auth login github');
}
