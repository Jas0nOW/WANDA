// =============================================================================
// Wanda — Tool Registry
// =============================================================================
// Register tools with zod schemas. Validate params before execution.
// Dangerous tools flagged with `dangerous: true` (OTP approval in Level 2).

import { z, type ZodTypeAny } from 'zod';
import { zodToJsonSchema } from './zod-to-json-schema.js';
import type { ToolCall, ToolResult, Logger } from '@wanda/shared';

export interface ToolDefinitionForLLM {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
}

export interface RegisteredTool<T = unknown> {
    readonly name: string;
    readonly description: string;
    readonly dangerous: boolean;
    readonly schema: ZodTypeAny;
    readonly execute: (params: T, context: ToolExecCtx) => Promise<string>;
}

export interface ToolExecCtx {
    readonly senderUserId: string;
}

export interface ToolRegistry {
    register<T>(tool: RegisteredTool<T>): void;
    getDefinitions(): ToolDefinitionForLLM[];
    execute(toolCall: ToolCall, senderUserId: string): Promise<ToolResult>;
    has(name: string): boolean;
}

export function createToolRegistry(logger: Logger): ToolRegistry {
    const tools = new Map<string, RegisteredTool>();

    return {
        register<T>(tool: RegisteredTool<T>): void {
            if (tools.has(tool.name)) {
                throw new Error(`Tool already registered: ${tool.name}`);
            }
            tools.set(tool.name, tool as RegisteredTool);
            logger.info({ tool: tool.name, dangerous: tool.dangerous }, 'Tool registered');
        },

        getDefinitions(): ToolDefinitionForLLM[] {
            return Array.from(tools.values()).map((t) => ({
                name: t.name,
                description: t.description,
                parameters: zodToJsonSchema(t.schema),
            }));
        },

        async execute(toolCall: ToolCall, senderUserId: string): Promise<ToolResult> {
            const tool = tools.get(toolCall.name);
            if (!tool) {
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: `Error: Unknown tool "${toolCall.name}"`,
                    isError: true,
                };
            }

            // Parse and validate arguments
            let parsedArgs: unknown;
            try {
                const rawArgs = JSON.parse(toolCall.arguments);
                parsedArgs = tool.schema.parse(rawArgs);
            } catch (error) {
                const msg = error instanceof z.ZodError
                    ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
                    : String(error);
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: `Validation error: ${msg}`,
                    isError: true,
                };
            }

            // Execute
            try {
                const result = await tool.execute(parsedArgs, { senderUserId });
                logger.info({ tool: toolCall.name }, 'Tool executed successfully');
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result,
                    isError: false,
                };
            } catch (error) {
                logger.error({ err: error, tool: toolCall.name }, 'Tool execution error');
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    isError: true,
                };
            }
        },

        has(name: string): boolean {
            return tools.has(name);
        },
    };
}
