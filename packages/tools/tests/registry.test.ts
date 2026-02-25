// =============================================================================
// Tests — @wanda/tools: Tool registry
// =============================================================================

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createToolRegistry } from '../src/registry.js';

// Minimal mock logger — avoids pino dependency in tools package
const logger = {
    info: () => { },
    warn: () => { },
    error: () => { },
    debug: () => { },
    trace: () => { },
    fatal: () => { },
    child: () => logger,
    level: 'silent',
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('ToolRegistry', () => {
    it('registers and retrieves tool definitions', () => {
        const registry = createToolRegistry(logger);
        registry.register({
            name: 'test_tool',
            description: 'A test tool',
            dangerous: false,
            schema: z.object({ message: z.string() }),
            async execute(params: { message: string }) {
                return `Received: ${params.message}`;
            },
        });

        const defs = registry.getDefinitions();
        expect(defs).toHaveLength(1);
        expect(defs[0]!.name).toBe('test_tool');
        expect(defs[0]!.description).toBe('A test tool');
    });

    it('executes a tool with valid parameters', async () => {
        const registry = createToolRegistry(logger);
        registry.register({
            name: 'greet',
            description: 'Greet',
            dangerous: false,
            schema: z.object({ name: z.string() }),
            async execute(params: { name: string }) {
                return `Hello, ${params.name}!`;
            },
        });

        const result = await registry.execute(
            { id: 'tc1', name: 'greet', arguments: '{"name":"Jannis"}' },
            'user1',
        );

        expect(result.isError).toBe(false);
        expect(result.result).toBe('Hello, Jannis!');
    });

    it('returns error for unknown tool', async () => {
        const registry = createToolRegistry(logger);
        const result = await registry.execute(
            { id: 'tc1', name: 'nonexistent', arguments: '{}' },
            'user1',
        );
        expect(result.isError).toBe(true);
        expect(result.result).toContain('Unknown tool');
    });

    it('validates parameters and returns error for invalid input', async () => {
        const registry = createToolRegistry(logger);
        registry.register({
            name: 'strict',
            description: 'Strict params',
            dangerous: false,
            schema: z.object({ count: z.number().int().positive() }),
            async execute(params: { count: number }) {
                return String(params.count);
            },
        });

        const result = await registry.execute(
            { id: 'tc1', name: 'strict', arguments: '{"count": -1}' },
            'user1',
        );
        expect(result.isError).toBe(true);
        expect(result.result).toContain('Validation error');
    });

    it('prevents duplicate registration', () => {
        const registry = createToolRegistry(logger);
        const tool = {
            name: 'dup',
            description: 'Dup',
            dangerous: false,
            schema: z.object({}),
            async execute() { return 'ok'; },
        };
        registry.register(tool);
        expect(() => registry.register(tool)).toThrow('already registered');
    });
});
