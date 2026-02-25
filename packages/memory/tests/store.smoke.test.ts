import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '@wanda/shared';
import { createMemoryStore } from '../src/store.js';

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop();
        if (dir) {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

describe('memory store smoke', () => {
    it('stores and searches facts/messages', () => {
        const dataDir = mkdtempSync(join(tmpdir(), 'wanda-memory-'));
        tempDirs.push(dataDir);

        const store = createMemoryStore(
            dataDir,
            createLogger({ level: 'silent', name: 'memory-test' }),
        );

        try {
            store.addMessage('session-1', 'user', 'Need a proposal follow-up');
            store.addMessage('session-1', 'assistant', 'I will draft the follow-up.');
            store.addFact('Client ACME requested pricing update');

            const recent = store.getRecentMessages('session-1', 5);
            expect(recent.length).toBe(2);
            const contents = recent.map((entry) => entry.content);
            expect(contents.some((text) => text.includes('proposal'))).toBe(true);
            expect(contents.some((text) => text.includes('follow-up'))).toBe(true);

            const hits = store.search('pricing', 5);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0]?.content.toLowerCase()).toContain('pricing');
        } finally {
            store.close();
        }
    });
});
