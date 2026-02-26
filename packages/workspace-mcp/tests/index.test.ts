import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceMcpServer } from '../src/index.js';

vi.mock('node:fs/promises');

describe('WorkspaceMcpServer Security & Sandboxing', () => {
    let serverInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();
        serverInstance = new WorkspaceMcpServer();
    });

    const WORK_OS_ROOT = "/home/jannis/Schreibtisch/Work-OS";

    it('should allow reading from allowed directories', () => {
        const validPath = `${WORK_OS_ROOT}/business/project-1/file.txt`;
        expect(serverInstance.validatePath(validPath)).toBe(validPath);
    });

    it('should deny reading from unapproved top-level directories', () => {
        const invalidPath = `${WORK_OS_ROOT}/downloads/malicious.sh`;
        expect(() => serverInstance.validatePath(invalidPath)).toThrowError(/Access Denied/);
    });

    it('should deny reading backwards out of the workspace (Directory Traversal)', () => {
        const traversalPath = `${WORK_OS_ROOT}/business/../../../../etc/passwd`;
        expect(() => serverInstance.validatePath(traversalPath)).toThrowError(/Access Denied/);
    });

    it('should deny root-prefix bypass paths outside Work-OS', () => {
        const prefixBypassPath = `${WORK_OS_ROOT}-shadow/business/plan.md`;
        expect(() => serverInstance.validatePath(prefixBypassPath)).toThrowError(/Access Denied/);
    });

    it('should allow modifying allowed root files like settings.json', () => {
        const settingsPath = `${WORK_OS_ROOT}/settings.json`;
        expect(serverInstance.validatePath(settingsPath, true)).toBe(settingsPath);
    });

    it('should deny writing arbitrary unapproved files to the workspace root', () => {
        const rootInjectedPath = `${WORK_OS_ROOT}/injected.sh`;
        expect(() => serverInstance.validatePath(rootInjectedPath, true)).toThrowError(/Access Denied/);
    });
});
