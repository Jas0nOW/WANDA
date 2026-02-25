// =============================================================================
// Wanda — Docker Sandbox Runner (Config Only for Level 1)
// =============================================================================
// Defines the Docker sandbox configuration.
// Actual container execution deferred to Level 4 (when tools need it).

export interface SandboxConfig {
    readonly image: string;
    readonly user: string;
    readonly capDrop: string[];
    readonly securityOpt: string[];
    readonly readOnlyRootFs: boolean;
    readonly writablePaths: string[];
    readonly networkMode: string;
    readonly memoryLimit: string;
    readonly cpuLimit: string;
}

/**
 * Default hardened sandbox configuration.
 * Non-root, dropped caps, no-new-privileges, read-only root FS, network DENY.
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
    image: 'node:22-alpine',
    user: '1000:1000',
    capDrop: ['ALL'],
    securityOpt: ['no-new-privileges'],
    readOnlyRootFs: true,
    writablePaths: ['/data'],
    networkMode: 'none',
    memoryLimit: '256m',
    cpuLimit: '1',
};

/**
 * Generate Docker CLI arguments from sandbox config.
 * Useful for future `docker run` invocation.
 */
export function toDockerArgs(config: SandboxConfig = DEFAULT_SANDBOX_CONFIG): string[] {
    const args: string[] = [
        '--user', config.user,
        '--read-only',
        '--network', config.networkMode,
        '--memory', config.memoryLimit,
        '--cpus', config.cpuLimit,
    ];

    for (const cap of config.capDrop) {
        args.push('--cap-drop', cap);
    }

    for (const opt of config.securityOpt) {
        args.push('--security-opt', opt);
    }

    for (const path of config.writablePaths) {
        args.push('--tmpfs', `${path}:rw,noexec,nosuid,size=100m`);
    }

    return args;
}
