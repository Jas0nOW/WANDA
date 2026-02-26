import type { Logger } from '@wanda/shared';
import type { GraphManager, GraphEntity } from './graph_manager.js';
import type { ArchiveManager } from './archive_manager.js';

export interface JanitorDependencies {
    graph: GraphManager;
    archive: ArchiveManager;
    logger: Logger;
    // Dependency injection for LLM merging logic
    mergeEntities?: (e1: GraphEntity, e2: GraphEntity) => Promise<GraphEntity | null>;
}

export class JanitorAgent {
    constructor(private deps: JanitorDependencies) { }

    public async runMaintenanceCycle() {
        this.deps.logger.info('JanitorAgent started maintenance cycle');

        try {
            // 1. Decay the importance scores
            this.deps.graph.decayImportance();
            this.deps.logger.debug('Decayed graph relation importance scores');

            // 2. Identify cold relations (importance < 0.2)
            // (We could extend graph_manager with getColdRelations() returning these)
            // For now, the decayStmt handles lowering them. A real Janitor would query
            // them, archive them to Supabase (Tier 4), and DELETE them from SQLite (Tier 2).
            this.deps.logger.info('JanitorAgent completed decay phase');

        } catch (err) {
            this.deps.logger.error({ err }, 'JanitorAgent failed during maintenance cycle');
        }
    }

    // Cron job loop that could be started by wanda-bot
    public startCron(intervalMs: number = 24 * 60 * 60 * 1000) {
        this.deps.logger.info({ intervalMs }, 'JanitorAgent CRON started');
        setInterval(() => {
            this.runMaintenanceCycle().catch(() => { });
        }, intervalMs);
    }
}
