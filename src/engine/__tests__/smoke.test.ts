import { describe, it, expect } from 'vitest';
import { APP_NAME } from '../constants';

describe('scaffold', () => {
  it('names the app', () => {
    expect(APP_NAME).toBe('OATHBRAND');
  });
});
