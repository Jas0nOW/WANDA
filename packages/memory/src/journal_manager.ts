import { promises as fs, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from '@wanda/shared';

export interface JournalManager {
    readJournal(name: string): Promise<string | null>;
    updateJournal(name: string, content: string): Promise<void>;
    appendJournal(name: string, content: string): Promise<void>;
    listJournals(): Promise<string[]>;
}

export async function createJournalManager(dataDir: string, logger: Logger): Promise<JournalManager> {
    const journalsDir = join(dataDir, 'journals');

    // Ensure directory exists
    if (!existsSync(journalsDir)) {
        await fs.mkdir(journalsDir, { recursive: true });
        logger.info({ journalsDir }, 'Created journals directory');
    }

    const sanitizeName = (name: string) => {
        // Only allow alphanumeric, dash, underscore, and period, ensuring it ends with .md
        const clean = name.replace(/[^a-zA-Z0-9_.-]/g, '');
        return clean.endsWith('.md') ? clean : `${clean}.md`;
    };

    return {
        async readJournal(name: string) {
            const safeName = sanitizeName(name);
            const targetPath = join(journalsDir, safeName);
            if (!existsSync(targetPath)) return null;
            try {
                return await fs.readFile(targetPath, 'utf-8');
            } catch (err) {
                logger.error({ err, path: targetPath }, 'Failed to read journal');
                return null;
            }
        },

        async updateJournal(name: string, content: string) {
            const safeName = sanitizeName(name);
            const targetPath = join(journalsDir, safeName);
            await fs.writeFile(targetPath, content, 'utf-8');
            logger.debug({ journal: safeName }, 'Updated journal');
        },

        async appendJournal(name: string, content: string) {
            const safeName = sanitizeName(name);
            const targetPath = join(journalsDir, safeName);
            const timestamp = new Date().toISOString();
            const formattedAppend = `\n\n## Update: ${timestamp}\n${content}`;

            if (!existsSync(targetPath)) {
                await fs.writeFile(targetPath, `# ${safeName.replace('.md', '')}${formattedAppend}`, 'utf-8');
            } else {
                await fs.appendFile(targetPath, formattedAppend, 'utf-8');
            }
            logger.debug({ journal: safeName }, 'Appended to journal');
        },

        async listJournals() {
            try {
                const files = await fs.readdir(journalsDir);
                return files.filter(f => f.endsWith('.md'));
            } catch (err) {
                logger.error({ err }, 'Failed to list journals');
                return [];
            }
        }
    };
}
