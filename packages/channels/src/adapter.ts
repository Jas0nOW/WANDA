// =============================================================================
// Wanda — Channel Adapter Interface
// =============================================================================
// All channels implement this interface. Brain never knows which channel.

import type { InboundMessage, OutboundMessage } from '@wanda/shared';

/**
 * Channel adapter interface.
 * Each messaging platform implements this to normalize all I/O.
 */
export interface ChannelAdapter {
    /** Unique channel identifier (e.g., 'telegram', 'discord') */
    readonly id: string;

    /** Start receiving messages (long polling, websocket, etc.) */
    start(): Promise<void>;

    /** Stop receiving messages and clean up resources */
    stop(): Promise<void>;

    /** Send an outbound message through this channel */
    sendMessage(msg: OutboundMessage): Promise<void>;

    /** Register the handler that will be called for every inbound message */
    onMessage(handler: (msg: InboundMessage) => Promise<void>): void;
}
