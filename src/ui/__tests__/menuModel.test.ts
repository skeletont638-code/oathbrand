import { describe, it, expect } from 'vitest';
import { titleMenuModel } from '../title';
import { pauseMenuModel } from '../pause';

describe('titleMenuModel', () => {
  it('a fresh start (no save) offers just BEGIN + SETTINGS', () => {
    const items = titleMenuModel({ hasSave: false, anyEndingSeen: false });
    expect(items.map((i) => i.id)).toEqual(['begin', 'settings']);
    const begin = items.find((i) => i.id === 'begin')!;
    expect(begin.label).toBe('BEGIN');
    expect(begin.confirm).toBe(false); // nothing to abandon
    expect(begin.danger).toBe(false);
  });

  it('a resumable vigil puts CONTINUE first and makes BEGIN a guarded restart', () => {
    const items = titleMenuModel({ hasSave: true, anyEndingSeen: false });
    expect(items.map((i) => i.id)).toEqual(['continue', 'begin', 'settings']);
    const begin = items.find((i) => i.id === 'begin')!;
    expect(begin.label).toBe('BEGIN ANEW');
    expect(begin.confirm).toBe(true); // abandoning a vigil asks twice
    expect(begin.danger).toBe(true);
  });

  it('once an ending is witnessed the Second Vigil appears', () => {
    const items = titleMenuModel({ hasSave: true, anyEndingSeen: true });
    expect(items.map((i) => i.id)).toEqual(['continue', 'begin', 'keep-vigil', 'settings']);
  });

  it('endings witnessed without a resumable save still offers the Second Vigil', () => {
    const items = titleMenuModel({ hasSave: false, anyEndingSeen: true });
    expect(items.map((i) => i.id)).toEqual(['begin', 'keep-vigil', 'settings']);
    expect(items.find((i) => i.id === 'begin')!.confirm).toBe(false);
  });

  it('SETTINGS is always present and last', () => {
    for (const hasSave of [true, false]) {
      for (const anyEndingSeen of [true, false]) {
        const items = titleMenuModel({ hasSave, anyEndingSeen });
        expect(items[items.length - 1].id).toBe('settings');
      }
    }
  });
});

describe('pauseMenuModel', () => {
  it('is resume, settings, then the dangerous quit', () => {
    const items = pauseMenuModel();
    expect(items.map((i) => i.id)).toEqual(['resume', 'settings', 'quit']);
    expect(items.find((i) => i.id === 'quit')!.danger).toBe(true);
    expect(items.find((i) => i.id === 'resume')!.danger).toBe(false);
  });
});
