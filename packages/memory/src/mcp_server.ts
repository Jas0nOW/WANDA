import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Logger } from '@wanda/shared';
import type { GraphManager } from './graph_manager.js';
import type { JournalManager } from './journal_manager.js';
import type { ArchiveManager } from './archive_manager.js';

export function createMemoryMcpServer(
    graph: GraphManager,
    journals: JournalManager,
    archive: ArchiveManager,
    logger: Logger
): Server {
    const server = new Server(
        { name: 'wanda-memory', version: '0.1.0' },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        logger.debug('MCP client requested memory tools list');
        return {
            tools: [
                {
                    name: 'store_graph_entity',
                    description: 'Store a node/entity in the Tier-2 Knowledge Graph (e.g. Person, Concept, Project).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Unique slug or UUID' },
                            name: { type: 'string' },
                            type: { type: 'string', description: 'e.g. person, concept, preference' },
                            metadata: { type: 'string', description: 'JSON string of extra data' }
                        },
                        required: ['id', 'name', 'type', 'metadata']
                    }
                },
                {
                    name: 'store_graph_relation',
                    description: 'Link two entities in the Graph (e.g. Jannis -> likes -> Pop!_OS).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sourceId: { type: 'string' },
                            targetId: { type: 'string' },
                            relationType: { type: 'string' },
                            weight: { type: 'number' }
                        },
                        required: ['sourceId', 'targetId', 'relationType', 'weight']
                    }
                },
                {
                    name: 'query_graph',
                    description: 'Traverse the graph to fetch an entity and its N-depth relations.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            rootEntityName: { type: 'string' },
                            maxDepth: { type: 'number', description: 'Usually 1 or 2' }
                        },
                        required: ['rootEntityName', 'maxDepth']
                    }
                },
                {
                    name: 'read_journal',
                    description: 'Read a Tier-3 human-readable Markdown journal file.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Filename, e.g. user_profile.md' }
                        },
                        required: ['name']
                    }
                },
                {
                    name: 'append_journal',
                    description: 'Append a timestamped entry to a Markdown journal.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            content: { type: 'string' }
                        },
                        required: ['name', 'content']
                    }
                },
                {
                    name: 'search_archive',
                    description: 'Semantic vector search through Tier-4 huge historical context.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            queryEmbedding: {
                                type: 'array',
                                items: { type: 'number' },
                                description: 'The vector to search for'
                            },
                        },
                        required: ['queryEmbedding']
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        logger.info({ tool: request.params.name }, 'Tool call received');

        try {
            switch (request.params.name) {
                case 'store_graph_entity': {
                    const args = request.params.arguments as any;
                    graph.addEntity(args);
                    return { content: [{ type: 'text', text: `Entity ${args.name} stored successfully.` }] };
                }
                case 'store_graph_relation': {
                    const args = request.params.arguments as any;
                    graph.addRelation(args);
                    return { content: [{ type: 'text', text: `Relation ${args.relationType} created/updated.` }] };
                }
                case 'query_graph': {
                    const args = request.params.arguments as any;
                    const subGraph = graph.getRelatedSubGraph(args.rootEntityName, args.maxDepth);
                    return { content: [{ type: 'text', text: JSON.stringify(subGraph, null, 2) }] };
                }
                case 'read_journal': {
                    const args = request.params.arguments as { name: string };
                    const text = await journals.readJournal(args.name);
                    if (!text) return { content: [{ type: 'text', text: 'Journal not found.' }] };
                    return { content: [{ type: 'text', text }] };
                }
                case 'append_journal': {
                    const args = request.params.arguments as { name: string, content: string };
                    await journals.appendJournal(args.name, args.content);
                    return { content: [{ type: 'text', text: `Appended to journal ${args.name}.` }] };
                }
                case 'search_archive': {
                    const args = request.params.arguments as { queryEmbedding: number[] };
                    const results = await archive.searchArchive(args.queryEmbedding);
                    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
                }
                default:
                    throw new Error(`Unknown tool: ${request.params.name}`);
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error({ tool: request.params.name, error: msg }, 'Tool execution failed');
            return {
                content: [{ type: 'text', text: `Error completing request: ${msg}` }],
                isError: true
            };
        }
    });

    return server;
}
