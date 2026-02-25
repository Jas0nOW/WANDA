// =============================================================================
// Wanda — Pairing Service (SQLite-backed)
// =============================================================================
// Manages user pairing: OTP generation, approval, revocation.
// Unknown users receive ZERO response — bot appears dead.

import Database from 'better-sqlite3';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import type { PairedUser, PairingRequest, Logger } from '@wanda/shared';

export interface PairingServiceConfig {
    readonly dataDir: string;
    readonly adminTelegramId: string;
}

export interface PairingServiceInterface {
    getPairedUser(userId: string, platform: string): PairedUser | undefined;
    updateLastSeen(userId: string, platform: string): void;
    createPairingRequest(userId: string, platform: string, username?: string): PairingRequest;
    approvePairing(otp: string): boolean;
    revokePairing(userId: string, platform: string): boolean;
    isAdmin(userId: string): boolean;
    close(): void;
}

/**
 * Generate a 6-digit OTP.
 */
function generateOtp(): string {
    return String(randomInt(100000, 999999));
}

export function createPairingService(
    config: PairingServiceConfig,
    logger: Logger,
): PairingServiceInterface {
    const dbPath = join(config.dataDir, 'pairing.db');
    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
    CREATE TABLE IF NOT EXISTS paired_users (
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      otp TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at TEXT,
      revoked_at TEXT,
      last_seen_at TEXT,
      PRIMARY KEY (user_id, platform)
    )
  `);

    // Bootstrap: ensure admin is always paired on ALL platforms
    const adminCheck = db.prepare(
        'SELECT user_id FROM paired_users WHERE user_id = ? AND platform = ?',
    );
    const adminBootstrapStmt = db.prepare(
        `INSERT INTO paired_users (user_id, platform, username, status, approved_at)
       VALUES (?, ?, 'admin', 'approved', datetime('now'))`,
    );
    for (const platform of ['telegram', 'webchat']) {
        if (!adminCheck.get(config.adminTelegramId, platform)) {
            adminBootstrapStmt.run(config.adminTelegramId, platform);
            logger.info({ adminId: config.adminTelegramId, platform }, 'Admin bootstrapped into pairing DB');
        }
    }

    const stmtGetUser = db.prepare(
        'SELECT * FROM paired_users WHERE user_id = ? AND platform = ?',
    );
    const stmtUpdateLastSeen = db.prepare(
        `UPDATE paired_users SET last_seen_at = datetime('now') WHERE user_id = ? AND platform = ?`,
    );
    const stmtUpsertPending = db.prepare(`
    INSERT INTO paired_users (user_id, platform, username, status, otp)
    VALUES (?, ?, ?, 'pending', ?)
    ON CONFLICT(user_id, platform) DO UPDATE SET
      status = 'pending',
      otp = excluded.otp,
      username = excluded.username
  `);
    const stmtApproveByOtp = db.prepare(`
    UPDATE paired_users SET status = 'approved', otp = NULL, approved_at = datetime('now')
    WHERE otp = ? AND status = 'pending'
  `);
    const stmtRevoke = db.prepare(`
    UPDATE paired_users SET status = 'revoked', revoked_at = datetime('now')
    WHERE user_id = ? AND platform = ?
  `);

    return {
        getPairedUser(userId: string, platform: string): PairedUser | undefined {
            const row = stmtGetUser.get(userId, platform) as Record<string, unknown> | undefined;
            if (!row) return undefined;
            return {
                userId: row.user_id as string,
                platform: row.platform as string,
                username: row.username as string | undefined,
                status: row.status as PairedUser['status'],
                otp: row.otp as string | undefined,
                createdAt: row.created_at as string,
                approvedAt: row.approved_at as string | undefined,
                revokedAt: row.revoked_at as string | undefined,
                lastSeenAt: row.last_seen_at as string | undefined,
            };
        },

        updateLastSeen(userId: string, platform: string): void {
            stmtUpdateLastSeen.run(userId, platform);
        },

        createPairingRequest(
            userId: string,
            platform: string,
            username?: string,
        ): PairingRequest {
            const otp = generateOtp();
            stmtUpsertPending.run(userId, platform, username ?? null, otp);
            logger.info({ userId, platform }, 'Pairing request created');
            return {
                userId,
                platform,
                username,
                otp,
                createdAt: new Date().toISOString(),
            };
        },

        approvePairing(otp: string): boolean {
            const result = stmtApproveByOtp.run(otp);
            if (result.changes > 0) {
                logger.info('Pairing approved via OTP');
                return true;
            }
            return false;
        },

        revokePairing(userId: string, platform: string): boolean {
            const result = stmtRevoke.run(userId, platform);
            if (result.changes > 0) {
                logger.info({ userId, platform }, 'Pairing revoked');
                return true;
            }
            return false;
        },

        isAdmin(userId: string): boolean {
            return userId === config.adminTelegramId;
        },

        close(): void {
            db.close();
        },
    };
}
