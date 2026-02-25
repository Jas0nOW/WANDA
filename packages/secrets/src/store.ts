// =============================================================================
// Wanda — Encrypted Secret Store
// =============================================================================
// Secrets stored in SQLite, encrypted with AES-256-GCM via @noble/ciphers.
// Master key from WANDA_SECRETS_MASTER_KEY env var (64 hex chars = 32 bytes).

import Database from 'better-sqlite3';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { Logger } from '@wanda/shared';

const NONCE_LENGTH = 12; // AES-GCM nonce: 12 bytes

export interface SecretStore {
    /** Store or update a secret. */
    set(id: string, value: string): void;
    /** Retrieve a decrypted secret by ID. Returns undefined if not found. */
    get(id: string): string | undefined;
    /** Delete a secret by ID. Returns true if deleted. */
    delete(id: string): boolean;
    /** List all secret IDs (never values). */
    list(): string[];
    /** Close the database connection. */
    close(): void;
}

/**
 * Create an encrypted secret store backed by SQLite.
 *
 * @param masterKeyHex - 64-character hex string (32 bytes)
 * @param dataDir - Directory for secrets.db
 * @param logger - Logger instance
 */
export function createSecretStore(
    masterKeyHex: string,
    dataDir: string,
    logger: Logger,
): SecretStore {
    if (masterKeyHex.length !== 64) {
        throw new Error('WANDA_SECRETS_MASTER_KEY must be 64 hex characters (32 bytes)');
    }

    const masterKey = Buffer.from(masterKeyHex, 'hex');
    const dbPath = join(dataDir, 'secrets.db');
    const db = new Database(dbPath);

    // WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY NOT NULL,
      encrypted_value BLOB NOT NULL,
      nonce BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

    const stmtInsert = db.prepare(`
    INSERT INTO secrets (id, encrypted_value, nonce, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      encrypted_value = excluded.encrypted_value,
      nonce = excluded.nonce,
      updated_at = datetime('now')
  `);

    const stmtGet = db.prepare('SELECT encrypted_value, nonce FROM secrets WHERE id = ?');
    const stmtDelete = db.prepare('DELETE FROM secrets WHERE id = ?');
    const stmtList = db.prepare('SELECT id FROM secrets ORDER BY id');

    function encrypt(plaintext: string): { ciphertext: Uint8Array; nonce: Uint8Array } {
        const nonce = randomBytes(NONCE_LENGTH);
        const aes = gcm(masterKey, nonce);
        const ciphertext = aes.encrypt(Buffer.from(plaintext, 'utf-8'));
        return { ciphertext, nonce };
    }

    function decrypt(ciphertext: Uint8Array, nonce: Uint8Array): string {
        const aes = gcm(masterKey, nonce);
        const plaintext = aes.decrypt(ciphertext);
        return Buffer.from(plaintext).toString('utf-8');
    }

    return {
        set(id: string, value: string): void {
            const { ciphertext, nonce } = encrypt(value);
            stmtInsert.run(id, ciphertext, nonce);
            logger.info({ secretId: id }, 'Secret stored');
        },

        get(id: string): string | undefined {
            const row = stmtGet.get(id) as
                | { encrypted_value: Buffer; nonce: Buffer }
                | undefined;
            if (!row) return undefined;
            return decrypt(
                new Uint8Array(row.encrypted_value),
                new Uint8Array(row.nonce),
            );
        },

        delete(id: string): boolean {
            const result = stmtDelete.run(id);
            if (result.changes > 0) {
                logger.info({ secretId: id }, 'Secret deleted');
                return true;
            }
            return false;
        },

        list(): string[] {
            const rows = stmtList.all() as Array<{ id: string }>;
            return rows.map((r) => r.id);
        },

        close(): void {
            db.close();
        },
    };
}
