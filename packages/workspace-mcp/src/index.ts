import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ErrorCode,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as fssync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// The base directory for all Work-OS operations
const WORK_OS_ROOT = "/home/jannis/Schreibtisch/Work-OS";
const WORK_OS_ROOT_REAL = fssync.realpathSync.native(WORK_OS_ROOT);

// Allowed top-level directories according to GITHUB_WORKSPACE_PROCEDURE.md
const ALLOWED_DIRS = ["business", "personal", "memory", "40_Products", "systems"];
// Specific allowed files at the root
const ALLOWED_ROOT_FILES = ["settings.json", "docker-compose.yml", ".env"];

export class WorkspaceMcpServer {
    public server: Server;

    constructor() {
        this.server = new Server(
            { name: "workspace-mcp", version: "0.1.0" },
            { capabilities: { tools: {} } }
        );
        this.setupHandlers();
        this.setupErrorHandling();
    }

    private setupErrorHandling() {
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    /**
     * Validates if a target absolute path complies with the Work-OS procedure.
     */
    private validatePath(targetPath: string, isFileWrite = false): string {
        const canonicalTarget = this.canonicalizeTargetPath(targetPath);
        if (!this.isWithinWorkOs(canonicalTarget)) {
            throw new Error(`Access Denied: Path must be within ${WORK_OS_ROOT}`);
        }

        const relativePath = path.relative(WORK_OS_ROOT_REAL, canonicalTarget);
        if (!relativePath) {
            if (isFileWrite) {
                throw new Error("Access Denied: Cannot write directly to the Work-OS root.");
            }
            return canonicalTarget;
        }

        const firstSegment = relativePath.split(path.sep)[0] || "";
        const isAllowedDir = ALLOWED_DIRS.includes(firstSegment);
        const isAllowedRootFile = ALLOWED_ROOT_FILES.includes(relativePath);

        // If writing directly to root, it must be an allowed root file
        if (isFileWrite && !relativePath.includes(path.sep) && !isAllowedRootFile) {
            throw new Error(`Access Denied: Cannot create unapproved files in the Work-OS root. Allowed root files: ${ALLOWED_ROOT_FILES.join(", ")}`);
        }

        if (!isAllowedDir && !isAllowedRootFile) {
            throw new Error(`Access Denied: Directory or file '${firstSegment}' is not allowed at the top level of Work-OS.`);
        }

        return canonicalTarget;
    }

    private isWithinWorkOs(candidatePath: string): boolean {
        return candidatePath === WORK_OS_ROOT_REAL || candidatePath.startsWith(`${WORK_OS_ROOT_REAL}${path.sep}`);
    }

    private canonicalizeTargetPath(targetPath: string): string {
        const absoluteTarget = path.resolve(targetPath);
        let probe = absoluteTarget;

        // Resolve the nearest existing ancestor to collapse symlinks safely.
        while (!fssync.existsSync(probe)) {
            const parent = path.dirname(probe);
            if (parent === probe) break;
            probe = parent;
        }

        const canonicalExisting = fssync.realpathSync.native(probe);
        const remainder = path.relative(probe, absoluteTarget);
        return path.resolve(canonicalExisting, remainder);
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "workspace_read_file",
                    description: "Reads a text file strictly within the Work-OS boundaries.",
                    inputSchema: zodToJsonSchema(z.object({
                        filePath: z.string().describe("Absolute path to the file"),
                    })),
                },
                {
                    name: "workspace_write_file",
                    description: "Writes content to a file strictly within the Work-OS boundaries.",
                    inputSchema: zodToJsonSchema(z.object({
                        filePath: z.string().describe("Absolute path to the file"),
                        content: z.string().describe("Content to write"),
                    })),
                },
                {
                    name: "workspace_list_dir",
                    description: "Lists contents of a directory strictly within the Work-OS boundaries.",
                    inputSchema: zodToJsonSchema(z.object({
                        dirPath: z.string().describe("Absolute path to the directory"),
                    })),
                }
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case "workspace_read_file": {
                        const { filePath } = request.params.arguments as { filePath: string };
                        const validPath = this.validatePath(filePath);
                        const content = await fs.readFile(validPath, "utf-8");
                        return { content: [{ type: "text", text: content }] };
                    }
                    case "workspace_write_file": {
                        const { filePath, content } = request.params.arguments as { filePath: string, content: string };
                        const validPath = this.validatePath(filePath, true);
                        // Ensure directory exists
                        await fs.mkdir(path.dirname(validPath), { recursive: true });
                        await fs.writeFile(validPath, content, "utf-8");
                        return { content: [{ type: "text", text: `Successfully wrote to ${validPath}` }] };
                    }
                    case "workspace_list_dir": {
                        const { dirPath } = request.params.arguments as { dirPath: string };
                        const validPath = this.validatePath(dirPath);
                        const dirents = await fs.readdir(validPath, { withFileTypes: true });
                        const list = dirents.map(d => `${d.isDirectory() ? '[DIR]' : '[FILE]'} ${d.name}`).join("\n");
                        return { content: [{ type: "text", text: list || "(empty directory)" }] };
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
                }
            } catch (error) {
                return {
                    content: [{ type: "text", text: `Workspace MCP Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true,
                };
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Workspace MCP Server running on stdio");
    }
}

// Simple zodToJsonSchema utility to avoid another heavy dependency
function zodToJsonSchema(schema: z.ZodTypeAny): any {
    // simplified implementation for string properties
    if (schema instanceof z.ZodObject) {
        const properties: Record<string, any> = {};
        const required: string[] = [];
        for (const [key, value] of Object.entries(schema.shape)) {
            if (value instanceof z.ZodString) {
                properties[key] = { type: "string" };
                if (value._def.description) {
                    properties[key].description = value._def.description;
                }
            }
            if (!(value as z.ZodTypeAny).isOptional()) required.push(key);
        }
        return { type: "object", properties, required };
    }
    return { type: "object" };
}

import { fileURLToPath } from 'url';

// Only run the Stdio server if this file is executed directly (e.g. npx workspace-mcp)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = new WorkspaceMcpServer();
    server.run().catch(console.error);
}
