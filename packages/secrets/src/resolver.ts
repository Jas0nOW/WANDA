// =============================================================================
// Wanda — Secret Resolver
// =============================================================================
// Replaces secret://<id> patterns with decrypted values at tool execution time.
// This MUST only be called by the tool runner, NEVER by prompt assembly.

import type { SecretStore } from './store.js';

const SECRET_PATTERN = /secret:\/\/([a-zA-Z0-9_-]+)/g;

/**
 * Resolve all secret://<id> references in a string by replacing them
 * with the decrypted secret values from the store.
 *
 * @throws Error if a referenced secret is not found.
 */
export function resolveSecrets(input: string, store: SecretStore): string {
    return input.replace(SECRET_PATTERN, (_match, id: string) => {
        const value = store.get(id);
        if (value === undefined) {
            throw new Error(`Secret not found: secret://${id}`);
        }
        return value;
    });
}

/**
 * Check if a string contains any secret:// references.
 */
export function hasSecretRefs(input: string): boolean {
    SECRET_PATTERN.lastIndex = 0;
    return SECRET_PATTERN.test(input);
}
