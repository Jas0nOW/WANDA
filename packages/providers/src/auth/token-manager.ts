// =============================================================================
// Wanda — Token Manager (Encrypted OAuth Token Storage + Auto-Refresh)
// =============================================================================
// Stores OAuth tokens encrypted via the secret store. Handles expiry checks
// and automatic refresh. Falls back to API key if no valid OAuth token.

import type { Logger } from '@wanda/shared';

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // Unix timestamp (ms)
    tokenType?: string;
    scope?: string;
}

export interface TokenStore {
    /** Get a valid access token, auto-refreshing if expired. Returns null if no token. */
    getAccessToken(providerId: string, accountId: string): Promise<string | null>;

    /** Store new tokens for a provider/account. */
    storeTokens(providerId: string, accountId: string, tokens: OAuthTokens): void;

    /** Check if tokens exist for a provider/account. */
    hasTokens(providerId: string, accountId: string): boolean;

    /** Remove tokens for a provider/account. */
    removeTokens(providerId: string, accountId: string): void;

    /** List all stored token entries. */
    listEntries(): Array<{ providerId: string; accountId: string; expiresAt: number }>;
}

export type RefreshFunction = (refreshToken: string) => Promise<OAuthTokens>;

export function createTokenManager(
    secretStore: { get(id: string): string | undefined; set(id: string, value: string): void; delete(id: string): void; list(): string[] },
    refreshers: Map<string, RefreshFunction>,
    logger: Logger,
): TokenStore {
    function tokenKey(providerId: string, accountId: string): string {
        return `oauth-token:${providerId}:${accountId}`;
    }

    function loadTokens(providerId: string, accountId: string): OAuthTokens | null {
        const raw = secretStore.get(tokenKey(providerId, accountId));
        if (!raw) return null;
        try {
            return JSON.parse(raw) as OAuthTokens;
        } catch {
            logger.warn({ providerId, accountId }, 'Corrupted token data — removing');
            secretStore.delete(tokenKey(providerId, accountId));
            return null;
        }
    }

    function saveTokens(providerId: string, accountId: string, tokens: OAuthTokens): void {
        secretStore.set(tokenKey(providerId, accountId), JSON.stringify(tokens));
    }

    return {
        async getAccessToken(providerId: string, accountId: string): Promise<string | null> {
            const tokens = loadTokens(providerId, accountId);
            if (!tokens) return null;

            // Check if still valid (with 60s buffer)
            if (Date.now() < tokens.expiresAt - 60_000) {
                return tokens.accessToken;
            }

            // Try refresh
            if (!tokens.refreshToken) {
                logger.warn({ providerId, accountId }, 'Token expired, no refresh token — removing');
                secretStore.delete(tokenKey(providerId, accountId));
                return null;
            }

            const refreshFn = refreshers.get(providerId);
            if (!refreshFn) {
                logger.warn({ providerId }, 'No refresh function registered — token expired');
                return null;
            }

            try {
                logger.info({ providerId, accountId }, 'Refreshing OAuth token');
                const newTokens = await refreshFn(tokens.refreshToken);
                // Preserve refresh token if not returned
                if (!newTokens.refreshToken && tokens.refreshToken) {
                    newTokens.refreshToken = tokens.refreshToken;
                }
                saveTokens(providerId, accountId, newTokens);
                return newTokens.accessToken;
            } catch (err) {
                logger.error({ err, providerId, accountId }, 'Token refresh failed');
                return null;
            }
        },

        storeTokens(providerId: string, accountId: string, tokens: OAuthTokens): void {
            saveTokens(providerId, accountId, tokens);
            logger.info(
                { providerId, accountId, expiresAt: new Date(tokens.expiresAt).toISOString() },
                'OAuth tokens stored',
            );
        },

        hasTokens(providerId: string, accountId: string): boolean {
            return loadTokens(providerId, accountId) !== null;
        },

        removeTokens(providerId: string, accountId: string): void {
            secretStore.delete(tokenKey(providerId, accountId));
            logger.info({ providerId, accountId }, 'OAuth tokens removed');
        },

        listEntries(): Array<{ providerId: string; accountId: string; expiresAt: number }> {
            const entries: Array<{ providerId: string; accountId: string; expiresAt: number }> = [];
            const allKeys = secretStore.list();
            for (const key of allKeys) {
                if (key.startsWith('oauth-token:')) {
                    const parts = key.split(':');
                    const providerId = parts[1];
                    const accountId = parts[2];
                    if (providerId && accountId) {
                        const tokens = loadTokens(providerId, accountId);
                        if (tokens) {
                            entries.push({ providerId, accountId, expiresAt: tokens.expiresAt });
                        }
                    }
                }
            }
            return entries;
        },
    };
}
