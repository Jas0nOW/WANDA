import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGraphManager } from '../src/graph_manager.js';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
} as any;

describe('Tier 2: Graph Manager (SQLite)', () => {
    const testDir = join(tmpdir(), `wanda-test-graph-${Date.now()}`);
    let manager: ReturnType<typeof createGraphManager>;

    beforeEach(() => {
        if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
        manager = createGraphManager(testDir, mockLogger);
    });

    afterEach(() => {
        manager.close();
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should insert and search entities', () => {
        manager.addEntity({
            id: 'e1',
            name: 'Wanda',
            type: 'ai',
            metadata: '{"version":"gen2"}'
        });

        manager.addEntity({
            id: 'e2',
            name: 'Pop!_OS',
            type: 'os',
            metadata: '{"distro":"linux"}'
        });

        const results = manager.searchEntities('Wanda');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Wanda');

        const typeResults = manager.searchEntities('os');
        expect(typeResults).toHaveLength(1);
        expect(typeResults[0].name).toBe('Pop!_OS');
    });

    it('should create relations and traverse the graph', () => {
        manager.addEntity({ id: 'u1', name: 'Jannis', type: 'user', metadata: '{}' });
        manager.addEntity({ id: 'os1', name: 'Pop!_OS', type: 'os', metadata: '{}' });
        manager.addEntity({ id: 'tool1', name: 'AERIS', type: 'software', metadata: '{}' });

        manager.addRelation({ sourceId: 'u1', targetId: 'os1', relationType: 'uses', weight: 1.0 });
        manager.addRelation({ sourceId: 'u1', targetId: 'tool1', relationType: 'builds', weight: 0.9 });

        const subGraph = manager.getRelatedSubGraph('Jannis', 1);

        // Should find Jannis, Pop!_OS, and AERIS
        expect(subGraph.entities.length).toBe(3);
        const names = subGraph.entities.map(e => e.name);
        expect(names).toContain('Jannis');
        expect(names).toContain('Pop!_OS');
        expect(names).toContain('AERIS');

        // Should find 2 relations
        expect(subGraph.relations.length).toBe(2);
    });

    it('should correctly decay importance scores', () => {
        manager.addEntity({ id: 'e1', name: 'A', type: 'x', metadata: '{}' });
        manager.addEntity({ id: 'e2', name: 'B', type: 'y', metadata: '{}' });

        manager.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'test', weight: 1.0 });

        // Force a query to check initial score
        const initial = manager.getRelatedSubGraph('A', 1);
        expect(initial.relations[0].importanceScore).toBe(1.0);

        manager.decayImportance();

        const decayed = manager.getRelatedSubGraph('A', 1);
        // importance score should be 1.0 * 0.95 = 0.95
        expect(decayed.relations[0].importanceScore).toBeCloseTo(0.95);
    });
});
