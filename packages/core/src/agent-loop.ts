// =============================================================================
// Wanda — Agent Loop
// =============================================================================
// Receive message → check pairing → assemble context → call LLM → parse tool
// calls → execute tools → send response. Enforces hard safety limits.
// Supports ModelRouter for multi-provider fallback chains.

import type {
    InboundMessage,
    OutboundMessage,
    LLMMessage,
    LLMResponse,
    ToolCall,
    ToolResult,
    LifecycleHooks,
    WandaConfig,
    Logger,
    PairedUser,
} from '@wanda/shared';

// --- Interfaces for injected dependencies ---

export interface ToolDefinitionForLLM {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
}

/** LLM chat interface — can be a direct provider OR a ModelRouter. */
export interface LLMChat {
    chat(
        agentId: string,
        messages: LLMMessage[],
        tools: ToolDefinitionForLLM[],
        overrides?: {
            readonly model?: string;
            readonly reasoning?: 'low' | 'high';
            readonly thinking?: boolean;
        }
    ): Promise<LLMResponse>;
}

export interface ToolExecutor {
    getDefinitions(): ToolDefinitionForLLM[];
    execute(toolCall: ToolCall, senderUserId: string): Promise<ToolResult>;
}

export interface PairingService {
    getPairedUser(userId: string, platform: string): PairedUser | undefined;
    updateLastSeen(userId: string, platform: string): void;
}

export interface MessageSender {
    send(msg: OutboundMessage): Promise<void>;
}

// --- Agent Loop ---

export interface AgentLoopDeps {
    llm: LLMChat;
    tools: ToolExecutor;
    pairing: PairingService;
    sender: MessageSender;
    hooks: LifecycleHooks;
    config: WandaConfig;
    logger: Logger;
    systemPrompt: string;
    agentId?: string; // defaults to 'default'
}

export interface AgentLoopResult {
    readonly iterations: number;
    readonly toolCallsTotal: number;
    readonly finalResponse?: string;
    readonly abortReason?: string;
}

/**
 * Run the agent loop for a single inbound message.
 * Returns when the LLM produces a final text response (no more tool calls)
 * or when a safety limit is hit.
 */
export async function runAgentLoop(
    message: InboundMessage,
    deps: AgentLoopDeps,
): Promise<AgentLoopResult> {
    const { llm, tools, pairing, sender, hooks, config, logger } = deps;
    const agentId = deps.agentId ?? 'default';

    // --- Pairing check ---
    const pairedUser = pairing.getPairedUser(message.sender.userId, message.sender.platform);
    if (!pairedUser || pairedUser.status !== 'approved') {
        logger.warn({ userId: message.sender.userId, platform: message.sender.platform }, 'Unpaired user — rejected');
        await sender.send({
            channelId: message.channelId,
            recipientId: message.sender.userId,
            text: '⚠️ Access denied. This user is not paired.',
            replyToMessageId: message.id,
        });
        return { iterations: 0, toolCallsTotal: 0, abortReason: 'unpaired' };
    }

    pairing.updateLastSeen(message.sender.userId, message.sender.platform);

    // --- Hook: onMessageReceived ---
    if (hooks.onMessageReceived) {
        await hooks.onMessageReceived({ message, pairedUser });
    }

    // --- Build conversation ---
    const conversation: LLMMessage[] = [
        { role: 'system', content: deps.systemPrompt },
        { role: 'user', content: message.text },
    ];

    const toolDefs = tools.getDefinitions();
    let iterations = 0;
    let toolCallsTotal = 0;

    // --- Timeout setup ---
    const deadline = Date.now() + config.loopTimeoutMs;

    while (iterations < config.loopMaxIterations) {
        if (Date.now() > deadline) {
            logger.warn({ iterations, toolCallsTotal }, 'Agent loop timeout');
            const timeoutMsg = 'I ran out of time processing your request. Please try again.';
            await sender.send({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: timeoutMsg,
                replyToMessageId: message.id,
            });
            return { iterations, toolCallsTotal, abortReason: 'timeout' };
        }

        iterations++;

        // --- Hook: beforeLlm ---
        let currentMessages = [...conversation];
        let currentTools = toolDefs;
        if (hooks.beforeLlm) {
            const hookResult = await hooks.beforeLlm({ messages: currentMessages, tools: currentTools, model: 'default' });
            currentMessages = [...hookResult.messages] as LLMMessage[];
            currentTools = [...hookResult.tools] as ToolDefinitionForLLM[];
        }

        // --- LLM call (via ModelRouter with auto-fallback) ---
        let response: LLMResponse;
        try {
            response = await llm.chat(agentId, currentMessages, currentTools, message.overrides);
        } catch (error) {
            logger.error({ err: error }, 'LLM call failed (all providers exhausted)');
            if (hooks.onError) {
                await hooks.onError({
                    error: error instanceof Error ? error : new Error(String(error)),
                    phase: 'llm',
                    message,
                });
            }
            await sender.send({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: 'All LLM providers are currently unavailable. Please try again later.',
                replyToMessageId: message.id,
            });
            return { iterations, toolCallsTotal, abortReason: 'llm_error' };
        }

        // --- Hook: afterLlm ---
        if (hooks.afterLlm) {
            await hooks.afterLlm(response);
        }

        // --- No tool calls → final response ---
        if (!response.toolCalls || response.toolCalls.length === 0) {
            const finalText = response.content || 'I have nothing to say.';
            await sender.send({
                channelId: message.channelId,
                recipientId: message.sender.userId,
                text: finalText,
                replyToMessageId: message.id,
            });
            return { iterations, toolCallsTotal, finalResponse: finalText };
        }

        // --- Tool calls ---
        conversation.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
            if (toolCallsTotal >= config.loopMaxToolCalls) {
                logger.warn({ toolCallsTotal }, 'Max tool calls reached');
                conversation.push({
                    role: 'tool',
                    content: 'Error: Maximum tool calls reached for this turn.',
                    toolCallId: toolCall.id,
                });
                continue;
            }

            // --- Hook: beforeToolExec ---
            if (hooks.beforeToolExec) {
                const hookResult = await hooks.beforeToolExec({
                    toolCall,
                    parsedArgs: {},
                    sender: message.sender,
                });
                if (hookResult === 'deny') {
                    logger.info({ tool: toolCall.name }, 'Tool execution denied by hook');
                    conversation.push({
                        role: 'tool',
                        content: 'Error: Tool execution denied by policy.',
                        toolCallId: toolCall.id,
                    });
                    toolCallsTotal++;
                    continue;
                }
            }

            // --- Execute tool ---
            let result: ToolResult;
            try {
                result = await tools.execute(toolCall, message.sender.userId);
                toolCallsTotal++;
            } catch (error) {
                logger.error({ err: error, tool: toolCall.name }, 'Tool execution failed');
                result = {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    isError: true,
                };
                toolCallsTotal++;
            }

            // --- Hook: afterToolExec ---
            if (hooks.afterToolExec) {
                await hooks.afterToolExec(result);
            }

            conversation.push({
                role: 'tool',
                content: result.result,
                toolCallId: result.toolCallId,
            });
        }
    }

    // Loop exhausted
    logger.warn({ iterations, toolCallsTotal }, 'Agent loop max iterations reached');
    await sender.send({
        channelId: message.channelId,
        recipientId: message.sender.userId,
        text: 'I reached my maximum thinking steps. Please try rephrasing your request.',
        replyToMessageId: message.id,
    });
    return { iterations, toolCallsTotal, abortReason: 'max_iterations' };
}
