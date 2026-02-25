// =============================================================================
// Tests — @wanda/tools: get_current_time tool
// =============================================================================

import { describe, it, expect } from 'vitest';
import { getCurrentTimeTool } from '../src/tools/get-current-time.js';

describe('get_current_time', () => {
    it('returns current time in UTC', async () => {
        const result = await getCurrentTimeTool.execute({ timezone: 'UTC' }, { senderUserId: 'test' });
        expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('returns current time in Europe/Berlin', async () => {
        const result = await getCurrentTimeTool.execute({ timezone: 'Europe/Berlin' }, { senderUserId: 'test' });
        expect(result).toContain('GMT');
    });

    it('returns error for invalid timezone', async () => {
        const result = await getCurrentTimeTool.execute({ timezone: 'Invalid/Zone' }, { senderUserId: 'test' });
        expect(result).toContain('Error');
    });

    it('has correct metadata', () => {
        expect(getCurrentTimeTool.name).toBe('get_current_time');
        expect(getCurrentTimeTool.dangerous).toBe(false);
    });
});
