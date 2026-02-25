// =============================================================================
// Wanda — Memory Store (SQLite + FTS5 stub)
// =============================================================================
// Level 1: basic message logging + fact storage with FTS5 search.
// Level 2: vector embeddings, semantic search, compaction.

import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { Logger } from '@wanda/shared';

export interface MemoryEntry {
    readonly id: number;
    readonly type: 'message' | 'fact';
    readonly content: string;
    readonly metadata?: string; // JSON
    readonly createdAt: string;
}

export interface MemoryStore {
    addMessage(sessionId: string, role: string, content: string, metadata?: Record<string, unknown>): void;
    addFact(content: string, metadata?: Record<string, unknown>): void;
    search(query: string, limit?: number): MemoryEntry[];
    getRecentMessages(sessionId: string, limit?: number): MemoryEntry[];
    close(): void;
}

export function createMemoryStore(dataDir: string, logger: Logger): MemoryStore {
    const dbPath = join(dataDir, 'memory.db');
    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');

    db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('message', 'fact')),
      session_id TEXT,
      role TEXT,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

    // FTS5 virtual table for full-text search
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
    USING fts5(content, content=memories, content_rowid=id)
  `);

    // Triggers to keep FTS in sync
    db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END
  `);
    db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
    END
  `);

    const stmtInsert = db.prepare(`
    INSERT INTO memories (type, session_id, role, content, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);

    const stmtSearch = db.prepare(`
    SELECT m.id, m.type, m.content, m.metadata, m.created_at
    FROM memories_fts f
    JOIN memories m ON m.id = f.rowid
    WHERE memories_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

    const stmtRecentMessages = db.prepare(`
    SELECT id, type, content, metadata, created_at
    FROM memories
    WHERE type = 'message' AND session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

    logger.info('Memory store initialized');

    return {
        addMessage(sessionId: string, role: string, content: string, metadata?: Record<string, unknown>): void {
            stmtInsert.run('message', sessionId, role, content, metadata ? JSON.stringify(metadata) : null);
        },

        addFact(content: string, metadata?: Record<string, unknown>): void {
            stmtInsert.run('fact', null, null, content, metadata ? JSON.stringify(metadata) : null);
        },

        search(query: string, limit = 10): MemoryEntry[] {
            try {
                const rows = stmtSearch.all(query, limit) as Array<Record<string, unknown>>;
                return rows.map(mapRow);
            } catch {
                // FTS5 query syntax errors
                return [];
            }
        },

        getRecentMessages(sessionId: string, limit = 20): MemoryEntry[] {
            const rows = stmtRecentMessages.all(sessionId, limit) as Array<Record<string, unknown>>;
            return rows.map(mapRow).reverse(); // chronological order
        },

        close(): void {
            db.close();
        },
    };
}

function mapRow(row: Record<string, unknown>): MemoryEntry {
    return {
        id: row.id as number,
        type: row.type as 'message' | 'fact',
        content: row.content as string,
        metadata: row.metadata as string | undefined,
        createdAt: row.created_at as string,
    };
}
