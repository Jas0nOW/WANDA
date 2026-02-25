// =============================================================================
// Tests — @wanda/shared: Logger secret redaction
// =============================================================================

import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../src/logger.js';

describe('redactSecrets', () => {
  it('redacts Anthropic API keys', () => {
    const input = 'Using key sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456';
    expect(redactSecrets(input)).not.toContain('sk-ant-');
    expect(redactSecrets(input)).toContain('[REDACTED]');
  });

  it('redacts OpenAI API keys', () => {
    const input = 'Using key sk-proj-abcdefghijklmnopqrstuvwxyz';
    expect(redactSecrets(input)).not.toContain('sk-proj-');
    expect(redactSecrets(input)).toContain('[REDACTED]');
  });

  it('redacts secret:// handles', () => {
    const input = 'Using secret://my-api-key for auth';
    expect(redactSecrets(input)).toBe('Using [REDACTED] for auth');
  });

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
    expect(redactSecrets(input)).toContain('[REDACTED]');
    expect(redactSecrets(input)).not.toContain('eyJhbGciOiJ');
  });

  it('redacts GitHub tokens', () => {
    const input = 'Token: ghp_abcdefghijklmnopqrstuvwxyzABCDEFGH1234';
    expect(redactSecrets(input)).toContain('[REDACTED]');
    expect(redactSecrets(input)).not.toContain('ghp_');
  });

  it('leaves safe strings unchanged', () => {
    const input = 'Hello, this is a normal message with no secrets.';
    expect(redactSecrets(input)).toBe(input);
  });

  it('redacts multiple secrets in one string', () => {
    const input = 'Key1: sk-ant-api03-abc123def456ghi789 Key2: secret://db-password';
    const result = redactSecrets(input);
    expect(result).not.toContain('sk-ant-');
    expect(result).not.toContain('secret://');
    expect(result.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
