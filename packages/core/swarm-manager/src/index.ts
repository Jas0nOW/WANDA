import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { LLMGateway } from "@wanda/llm-gateway";
import { AgentBus } from "@wanda/agent-bus";
import { EventSource } from 'eventsource';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/index.js';
import type { InboundMessage } from '@wanda/shared';

// Polyfill EventSource for Node.js if missing
if (typeof globalThis.EventSource === 'undefined') {
    (globalThis as any).EventSource = EventSource;
}

export class SwarmManager {
    private llm: LLMGateway;
    private memoryClient: Client;
    private workspaceClient: Client;

    constructor(private bus: AgentBus, private hubBaseUrl: string = 'http://localhost:3000') {
        this.llm = new LLMGateway();

        this.memoryClient = new Client(
            { name: "wanda-swarm-memory", version: "0.1.0" },
            { capabilities: {} }
        );

        this.workspaceClient = new Client(
            { name: "wanda-swarm-workspace", version: "0.1.0" },
            { capabilities: {} }
        );
    }

    async start() {
        // Connect to local Hub MCPs via SSE
        console.log('[Swarm] Connecting to Memory MCP...');
        const memoryTransport = new SSEClientTransport(new URL('/mcp/memory/sse', this.hubBaseUrl));
        await this.memoryClient.connect(memoryTransport);

        console.log('[Swarm] Connecting to Workspace MCP...');
        const workspaceTransport = new SSEClientTransport(new URL('/mcp/workspace/sse', this.hubBaseUrl));
        await this.workspaceClient.connect(workspaceTransport);

        // Listen for inbound messages on the Universal AgentBus
        this.bus.onInbound(async (msg) => {
            console.log(`[Swarm] Received message from ${msg.sender.username}: ${msg.text}`);
            await this.processMessage(msg);
        });

        console.log('[Swarm] Manager Online and listening on AgentBus');
    }

    private async processMessage(msg: InboundMessage) {
        // Fetch tools from both MCPs
        const memToolsRes = await this.memoryClient.listTools();
        const wsToolsRes = await this.workspaceClient.listTools();

        const mcpTools = [...memToolsRes.tools, ...wsToolsRes.tools];

        // Format for OpenAI
        const openAiTools: ChatCompletionTool[] = mcpTools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema as Record<string, unknown>
            }
        }));

        let messages: ChatCompletionMessageParam[] = [
            { role: 'user', content: msg.text }
        ];

        let iterations = 0;
        const maxIterations = 5;

        // The ReAct Loop
        while (iterations < maxIterations) {
            iterations++;
            console.log(`[Swarm] ReAct iteration ${iterations}...`);

            const response = await this.llm.generate({
                systemPrompt: "You are WANDA, a highly capable AI assistant operating locally on Jannis' system. You have access to his Workspace and Memory graph via MCP tools.",
                messages: messages,
                tools: openAiTools
            });

            if (response.toolCalls && response.toolCalls.length > 0) {
                // Agent decided to use tools
                messages.push({
                    role: 'assistant',
                    content: response.content || "",
                    tool_calls: response.toolCalls
                } as ChatCompletionMessageParam);

                for (const tc of response.toolCalls) {
                    console.log(`[Swarm] Executing tool: ${tc.function.name}`);
                    const args = JSON.parse(tc.function.arguments);
                    let resultStr = '';

                    try {
                        let toolResult;
                        if (memToolsRes.tools.find(t => t.name === tc.function.name)) {
                            toolResult = await this.memoryClient.callTool({ name: tc.function.name, arguments: args });
                        } else {
                            toolResult = await this.workspaceClient.callTool({ name: tc.function.name, arguments: args });
                        }
                        resultStr = JSON.stringify(toolResult.content);
                    } catch (err: any) {
                        resultStr = `Tool Error: ${err.message}`;
                    }

                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: resultStr
                    } as ChatCompletionMessageParam);
                }
            } else {
                // Agent finished reasoning
                console.log(`[Swarm] Final response generated.`);
                this.bus.broadcast({
                    channelId: msg.channelId,
                    recipientId: msg.sender.userId,
                    text: response.content || "An error occurred generating a response.",
                    platform: msg.sender.platform
                });
                break;
            }
        }

        if (iterations >= maxIterations) {
            this.bus.broadcast({
                channelId: msg.channelId,
                recipientId: msg.sender.userId,
                text: "Agent reached iteration limit while reasoning.",
                platform: msg.sender.platform
            });
        }
    }
}
