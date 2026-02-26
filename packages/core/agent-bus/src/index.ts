import { z } from 'zod';
import mitt from 'mitt';
import { createLogger, type InboundMessage, type OutboundMessage } from '@wanda/shared';

const logger = createLogger({ name: 'agent-bus' });

// ---------------------------------------------------------------------------
// Agent Bus (The Universal Router)
// ---------------------------------------------------------------------------

type AgentBusEvents = {
    // Emitted by Channel Adapters when a user sends a message
    'inbound_message': InboundMessage;

    // Emitted by Wanda Core when it wants to reply
    'outbound_message': OutboundMessage;

    // Emitted by System (e.g., Janitor Agent, Heartbeat)
    'system_event': { type: string; payload: any };
};

export class AgentBus {
    // @ts-ignore - ESM default export typing mismatch
    private emitter = mitt<AgentBusEvents>();

    constructor() { }

    /**
     * Adapters call this to ingest a message into Wanda's brain
     */
    public ingest(message: InboundMessage) {
        if (!message || !message.id) {
            logger.error({ message }, "[AgentBus] Ingest format error: Missing ID");
            return false;
        }
        logger.debug({ messageId: message.id, channelId: message.channelId }, "Ingesting message");
        this.emitter.emit('inbound_message', message);
        return true;
    }

    /**
     * Wanda Core calls this to send a message out to a user
     */
    public broadcast(message: OutboundMessage) {
        if (!message || !message.recipientId) {
            logger.error({ message }, "[AgentBus] Broadcast format error: Missing recipientId");
            return false;
        }
        logger.debug({ recipientId: message.recipientId, channelId: message.channelId }, "Broadcasting message");
        this.emitter.emit('outbound_message', message);
        return true;
    }

    /**
     * Subscribe to inbound messages (useful for Wanda Core / Agent Loop)
     */
    public onInbound(handler: (msg: InboundMessage) => void) {
        this.emitter.on('inbound_message', handler);
    }

    /**
     * Subscribe to outbound messages (useful for Channel Adapters)
     */
    public onOutbound(handler: (msg: OutboundMessage) => void) {
        this.emitter.on('outbound_message', handler);
    }

    public emitSystemEvent(type: string, payload: any) {
        this.emitter.emit('system_event', { type, payload });
    }

    public onSystemEvent(handler: (event: { type: string, payload: any }) => void) {
        this.emitter.on('system_event', handler);
    }
}

// Singleton instance
export const bus = new AgentBus();
