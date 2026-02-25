// =============================================================================
// Wanda — Core Types
// =============================================================================
// All domain types used across packages. This is the single source of truth.

// --- Identity & Pairing ---

export type PairingStatus = 'pending' | 'approved' | 'revoked';

export interface UserIdentity {
    readonly userId: string; // platform-specific user ID (e.g., Telegram user_id)
    readonly platform: string; // e.g., 'telegram', 'discord'
    readonly username?: string; // platform display name
}

export interface PairedUser {
    readonly userId: string;
    readonly platform: string;
    readonly username?: string;
    readonly status: PairingStatus;
    readonly otp?: string;
    readonly createdAt: string; // ISO 8601
    readonly approvedAt?: string;
    readonly revokedAt?: string;
    readonly lastSeenAt?: string;
}

export interface PairingRequest {
    readonly userId: string;
    readonly platform: string;
    readonly username?: string;
    readonly otp: string;
    readonly createdAt: string;
}

// --- Messages ---

export interface MessageMedia {
    readonly type: 'photo' | 'voice' | 'video' | 'document';
    readonly url: string; // E.g. local path, http URL, or protocol prefix like telegram://
    readonly mimeType?: string;
}

export interface InboundMessage {
    readonly id: string; // unique message ID
    readonly channelId: string; // adapter ID (e.g., 'telegram')
    readonly sender: UserIdentity;
    readonly text: string;
    readonly timestamp: string; // ISO 8601
    readonly replyToMessageId?: string;
    readonly isGroupChat?: boolean;
    readonly media?: readonly MessageMedia[];
    readonly callbackQueryId?: string; // If this is an inline keyboard click
    readonly metadata?: Record<string, unknown>;
    readonly overrides?: {
        readonly model?: string;
        readonly reasoning?: 'low' | 'high';
        readonly thinking?: boolean;
    };
}

export interface InlineKeyboardButton {
    readonly text: string;
    readonly callbackData?: string;
    readonly url?: string;
}

export interface OutboundMessage {
    readonly channelId: string;
    readonly recipientId: string;
    readonly text: string;
    readonly replyToMessageId?: string;
    readonly media?: readonly MessageMedia[];
    readonly keyboard?: readonly (readonly InlineKeyboardButton[])[];
    readonly metadata?: Record<string, unknown>;
}

// --- LLM ---

export interface LLMMessage {
    readonly role: 'system' | 'user' | 'assistant' | 'tool';
    readonly content: string;
    readonly toolCallId?: string;
    readonly toolCalls?: ToolCall[];
}

export interface ToolCall {
    readonly id: string;
    readonly name: string;
    readonly arguments: string; // JSON string
}

export interface LLMResponse {
    readonly content: string;
    readonly toolCalls?: ToolCall[];
    readonly usage?: {
        readonly inputTokens: number;
        readonly outputTokens: number;
    };
    readonly stopReason?: string;
}

// --- Tools ---

export interface ToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly dangerous: boolean;
    readonly parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolResult {
    readonly toolCallId: string;
    readonly name: string;
    readonly result: string;
    readonly isError: boolean;
}

// --- Secrets ---

export interface SecretHandle {
    readonly id: string; // the part after secret://
}

// --- Lifecycle Hooks ---

export interface MessageContext {
    readonly message: InboundMessage;
    readonly pairedUser: PairedUser;
}

export interface LLMContext {
    readonly messages: readonly LLMMessage[];
    readonly tools: readonly { readonly name: string; readonly description: string; readonly parameters: Record<string, unknown> }[];
    readonly model: string;
}

export interface ToolExecContext {
    readonly toolCall: ToolCall;
    readonly parsedArgs: Record<string, unknown>;
    readonly sender: UserIdentity;
}

export interface ErrorContext {
    readonly error: Error;
    readonly phase: 'llm' | 'tool' | 'channel' | 'unknown';
    readonly message?: InboundMessage;
}

export type HookResult = void | 'deny';

export interface LifecycleHooks {
    onMessageReceived?: (ctx: MessageContext) => Promise<void>;
    beforeLlm?: (ctx: LLMContext) => Promise<LLMContext>;
    afterLlm?: (ctx: LLMResponse) => Promise<void>;
    beforeToolExec?: (ctx: ToolExecContext) => Promise<HookResult>;
    afterToolExec?: (ctx: ToolResult) => Promise<void>;
    onError?: (ctx: ErrorContext) => Promise<void>;
}

// --- Config ---

export interface WandaConfig {
    readonly botToken: string;
    readonly adminTelegramId: string;
    readonly adminTelegramChatId: string;
    readonly secretsMasterKey: string;
    readonly anthropicApiKey?: string;
    readonly logLevel: string;
    readonly nodeEnv: string;
    readonly loopMaxIterations: number;
    readonly loopMaxToolCalls: number;
    readonly loopTimeoutMs: number;
    readonly dataDir: string;
}
