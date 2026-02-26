import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@wanda/shared';

export interface ArchiveRecord {
    id: string; // UUID
    content: string;
    metadata: Record<string, unknown>;
    similarity?: number; // returned from similarity search
    created_at: string;
}

export interface ArchiveManager {
    archiveContext(content: string, embedding: number[], metadata?: Record<string, unknown>): Promise<boolean>;
    searchArchive(queryEmbedding: number[], matchThreshold?: number, matchCount?: number): Promise<ArchiveRecord[]>;
}

export function createArchiveManager(
    supabaseUrl: string,
    supabaseKey: string,
    logger: Logger
): ArchiveManager {
    if (!supabaseUrl || !supabaseKey) {
        logger.warn('ArchiveManager initialized without Supabase credentials. Operations will fail.');
    }

    const supabase: SupabaseClient = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'dummy');

    return {
        async archiveContext(content: string, embedding: number[], metadata: Record<string, unknown> = {}) {
            try {
                const { error } = await supabase
                    .from('archive_vectors')
                    .insert({
                        content,
                        embedding,
                        metadata
                    });

                if (error) {
                    logger.error({ err: error }, 'Failed to insert to Supabase archive');
                    return false;
                }
                logger.debug('Context archived successfully to Supabase');
                return true;
            } catch (err) {
                logger.error({ err }, 'Error in archiveContext');
                return false;
            }
        },

        async searchArchive(queryEmbedding: number[], matchThreshold = 0.7, matchCount = 5) {
            try {
                // Relies on a standard pgvector RPC function 'match_archive_vectors'
                const { data, error } = await supabase.rpc('match_archive_vectors', {
                    query_embedding: queryEmbedding,
                    match_threshold: matchThreshold,
                    match_count: matchCount
                });

                if (error) {
                    logger.error({ err: error }, 'Failed to query Supabase archive');
                    return [];
                }

                return data as ArchiveRecord[];
            } catch (err) {
                logger.error({ err }, 'Error in searchArchive');
                return [];
            }
        }
    };
}
