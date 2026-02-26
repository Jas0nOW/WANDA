import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createJournalManager } from '../src/journal_manager.js';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
} as any;

describe('Tier 3: Journal Manager (Markdown)', () => {
    const testDir = join(tmpdir(), `wanda-test-journal-${Date.now()}`);

    beforeEach(() => {
        if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it('should create and list journals correctly', async () => {
        const manager = await createJournalManager(testDir, mockLogger);

        await manager.updateJournal('user_profile', 'I love Pop!_OS');
        await manager.updateJournal('project_rules.md', 'Always test');

        const journals = await manager.listJournals();

        expect(journals.length).toBe(2);
        expect(journals).toContain('user_profile.md');
        expect(journals).toContain('project_rules.md');
    });

    it('should append to journals elegantly', async () => {
        const manager = await createJournalManager(testDir, mockLogger);

        // Append to non-existent should create it with title
        await manager.appendJournal('daily', 'woke up');

        const content1 = await manager.readJournal('daily');
        expect(content1).toContain('# daily');
        expect(content1).toContain('woke up');

        // Append to existing
        await manager.appendJournal('daily', 'ate breakfast');
        const content2 = await manager.readJournal('daily');
        expect(content2).toContain('ate breakfast');
        expect(content2).toContain('woke up');
    });
});
