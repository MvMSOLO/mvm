import { describe, it, expect } from 'vitest';
import { PhoneSceneEngine } from './phoneEngine.js';

describe('PhoneSceneEngine test suite', () => {
  it('exports PhoneSceneEngine class correctly', () => {
    expect(PhoneSceneEngine).toBeDefined();
    expect(typeof PhoneSceneEngine).toBe('function');
  });
});
