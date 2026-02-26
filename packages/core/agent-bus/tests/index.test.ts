import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bus } from '../src/index.js';
import type { InboundMessage, OutboundMessage } from '@wanda/shared';

describe('AgentBus (Universal Router)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should emit inbound_message upon valid ingest', () => {
        const handler = vi.fn();
        bus.onInbound(handler);

        const validMsg: InboundMessage = {
            id: 'msg-1',
            channelId: 'chan-1',
            sender: { userId: 'u-1', platform: 'telegram', username: 'Test' },
            text: 'Hello Wanda',
            timestamp: Date.now().toString(),
            isGroupChat: false,
        };

        const result = bus.ingest(validMsg);
        expect(result).toBe(true);
        expect(handler).toHaveBeenCalledWith(validMsg);
    });

    it('should reject invalid inbound messages missing ID', () => {
        const handler = vi.fn();
        bus.onInbound(handler);

        const invalidMsg = {
            channelId: 'chan-1',
            sender: { userId: 'u-1', platform: 'telegram', username: 'Test' },
        } as any;

        const result = bus.ingest(invalidMsg);
        expect(result).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it('should emit outbound_message upon valid broadcast', () => {
        const handler = vi.fn();
        bus.onOutbound(handler);

        const validOutMsg: OutboundMessage = {
            recipientId: 'u-2',
            channelId: 'chan-2',
            platform: 'webchat',
            text: 'Hello User',
        };

        const result = bus.broadcast(validOutMsg);
        expect(result).toBe(true);
        expect(handler).toHaveBeenCalledWith(validOutMsg);
    });
});
