// =============================================================================
// Wanda — get_current_time Tool
// =============================================================================
// Safe tool. Returns current date and time in specified timezone.

import { z } from 'zod';
import type { RegisteredTool } from '../registry.js';

const schema = z.object({
    timezone: z.string().default('UTC').describe('IANA timezone identifier (e.g., "Europe/Berlin")'),
});

type Params = z.infer<typeof schema>;

export const getCurrentTimeTool: RegisteredTool<Params> = {
    name: 'get_current_time',
    description: 'Returns the current date and time in the specified timezone.',
    dangerous: false,
    schema,
    async execute(params) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: params.timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short',
                hour12: false,
            });
            return formatter.format(now);
        } catch {
            return `Error: Invalid timezone "${params.timezone}". Use IANA format (e.g., "Europe/Berlin").`;
        }
    },
};
