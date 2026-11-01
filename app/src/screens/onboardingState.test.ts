import { beforeEach, describe, expect, it } from 'vitest';
import { isOnboarded, markOnboarded } from './onboardingState';

describe('onboardingState', () => {
  beforeEach(() => localStorage.clear());

  it('se muestra una sola vez (CA-36.1)', () => {
    expect(isOnboarded()).toBe(false);
    markOnboarded();
    expect(isOnboarded()).toBe(true);
  });
});
