import { describe, expect, it } from 'vitest';
import { DEFAULT_SANDBOX_CONFIG, toDockerArgs } from '../src/runner.js';

describe('sandbox runner config', () => {
    it('exposes hardened defaults', () => {
        expect(DEFAULT_SANDBOX_CONFIG.readOnlyRootFs).toBe(true);
        expect(DEFAULT_SANDBOX_CONFIG.networkMode).toBe('none');
        expect(DEFAULT_SANDBOX_CONFIG.capDrop).toContain('ALL');
        expect(DEFAULT_SANDBOX_CONFIG.securityOpt).toContain('no-new-privileges');
    });

    it('generates expected docker args', () => {
        const args = toDockerArgs();
        expect(args).toContain('--read-only');
        expect(args).toContain('--network');
        expect(args).toContain('none');
        expect(args).toContain('--cap-drop');
        expect(args).toContain('ALL');
        expect(args).toContain('--security-opt');
        expect(args).toContain('no-new-privileges');
    });
});
