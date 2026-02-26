import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { Logger } from '@wanda/shared';

export interface GraphEntity {
    id: string; // usually UUID or slug
    name: string;
    type: string; // e.g., 'person', 'concept', 'project', 'preference'
    metadata: string; // JSON
    createdAt: string;
}

export interface GraphRelation {
    sourceId: string;
    targetId: string;
    relationType: string; // e.g., 'works_on', 'likes', 'is_related_to'
    weight: number; // 0.0 to 1.0
    lastAccessed: string;
    importanceScore: number;
}

export interface GraphManager {
    addEntity(entity: Omit<GraphEntity, 'createdAt'>): void;
    addRelation(relation: Omit<GraphRelation, 'lastAccessed' | 'importanceScore'>): void;
    getRelatedSubGraph(rootEntityName: string, maxDepth?: number): { entities: GraphEntity[], relations: GraphRelation[] };
    searchEntities(query: string): GraphEntity[];
    decayImportance(): void; // Used by Janitor Agent
    close(): void;
}

export function createGraphManager(dataDir: string, logger: Logger): GraphManager {
    const dbPath = join(dataDir, 'graph.db');
    const db = new Database(dbPath);

    db.pragma('journal_mode = WAL');

    // --- Schema Initialization ---
    db.exec(`
        CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS relations (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation_type TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            last_accessed TEXT NOT NULL DEFAULT (datetime('now')),
            importance_score REAL DEFAULT 1.0,
            PRIMARY KEY (source_id, target_id, relation_type),
            FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
        CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
        CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
    `);

    // --- Prepared Statements ---
    const insertEntity = db.prepare(`
        INSERT INTO entities (id, name, type, metadata) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
            name=excluded.name, 
            type=excluded.type, 
            metadata=excluded.metadata
    `);

    const insertEntityByNameFallback = db.prepare(`
        INSERT INTO entities (id, name, type, metadata) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET 
            type=excluded.type, 
            metadata=excluded.metadata
    `);

    const insertRelation = db.prepare(`
        INSERT INTO relations (source_id, target_id, relation_type, weight)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(source_id, target_id, relation_type) DO UPDATE SET
            weight=excluded.weight,
            last_accessed=datetime('now'),
            importance_score=importance_score + 0.1
    `);

    const searchEntitiesStmt = db.prepare(`
        SELECT * FROM entities WHERE name LIKE ? OR type = ? LIMIT 20
    `);

    const decayStmt = db.prepare(`
        UPDATE relations 
        SET importance_score = importance_score * 0.95
        WHERE importance_score > 0.1
    `);

    logger.info('Tier-2 Graph Memory initialized');

    return {
        addEntity(entity) {
            try {
                insertEntity.run(entity.id, entity.name, entity.type, entity.metadata);
            } catch (err) {
                // If ID is different but name conflicts, it might throw UNIQUE constraint on name.
                insertEntityByNameFallback.run(entity.id, entity.name, entity.type, entity.metadata);
            }
        },

        addRelation(relation) {
            insertRelation.run(relation.sourceId, relation.targetId, relation.relationType, relation.weight);
        },

        getRelatedSubGraph(rootEntityName: string, maxDepth = 2) {
            // A recursive CTE to traverse the graph starting from the root entity name
            const query = `
                WITH RECURSIVE bfs_tree(id, depth) AS (
                    SELECT id, 0 FROM entities WHERE name = ?
                    UNION ALL
                    SELECT r.target_id, b.depth + 1
                    FROM relations r
                    JOIN bfs_tree b ON r.source_id = b.id
                    WHERE b.depth < ? AND r.importance_score > 0.2
                    
                    UNION ALL
                    
                    SELECT r.source_id, b.depth + 1
                    FROM relations r
                    JOIN bfs_tree b ON r.target_id = b.id
                    WHERE b.depth < ? AND r.importance_score > 0.2
                )
                SELECT DISTINCT id FROM bfs_tree;
            `;

            const relatedIdsStmt = db.prepare(query);
            const connectedRows = relatedIdsStmt.all(rootEntityName, maxDepth, maxDepth) as { id: string }[];
            const connectedIds = connectedRows.map(r => r.id);

            if (connectedIds.length === 0) {
                return { entities: [], relations: [] };
            }

            // Fetch actual entities
            const placeholders = connectedIds.map(() => '?').join(',');
            const entitiesStmt = db.prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`);
            const entities = entitiesStmt.all(...connectedIds) as any[];

            // Fetch relations connecting these entities
            const relationsStmt = db.prepare(`
                SELECT * FROM relations 
                WHERE source_id IN (${placeholders}) 
                  AND target_id IN (${placeholders})
            `);
            const relations = relationsStmt.all(...connectedIds, ...connectedIds) as any[];

            return {
                entities: entities.map(e => ({
                    id: e.id,
                    name: e.name,
                    type: e.type,
                    metadata: e.metadata,
                    createdAt: e.created_at
                })),
                relations: relations.map(r => ({
                    sourceId: r.source_id,
                    targetId: r.target_id,
                    relationType: r.relation_type,
                    weight: r.weight,
                    lastAccessed: r.last_accessed,
                    importanceScore: r.importance_score
                }))
            };
        },

        searchEntities(query: string) {
            const rows = searchEntitiesStmt.all(`%${query}%`, query) as any[];
            return rows.map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                metadata: e.metadata,
                createdAt: e.created_at
            }));
        },

        decayImportance() {
            decayStmt.run();
        },

        close() {
            db.close();
        }
    };
}
