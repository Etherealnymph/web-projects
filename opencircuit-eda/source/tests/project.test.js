import { describe, it, expect } from 'vitest';
import { readProject, projectJson, filePath } from '../src/project-store.js';

describe('project exchange', () => {
  it('imports both 2.x snapshots and 2.x folder archives with their relative models', () => {
    const single = readProject({
      name: 'old.scs',
      content: 'R1 (a b) resistor r=1k',
      layoutsBySubckt: {},
    });
    expect(single.entry).toBe('old.scs');
    const folder = readProject({
      folder: 'filters',
      files: [
        { path: 'top.cir', content: '.include "cells/rc.lib"' },
        { path: 'cells/rc.lib', content: '* model' },
      ],
    });
    expect(folder.title).toBe('filters');
    expect(folder.files).toHaveLength(2);
    expect(readProject(projectJson(folder)).files).toEqual(folder.files);
  });
  it('rejects ambiguous or missing file dependencies in project metadata', () => {
    const row = { path: 'top', content: '* test' };
    expect(() => readProject({ files: [row, row] })).toThrow();
    expect(() => readProject({ files: [row], entry: 'missing' })).toThrow();
    expect(() => filePath('../outside')).toThrow();
  });
  it('round-trips active file, analysis source mode and custom parts without internal records', () => {
    const data = {
      title: '工作点',
      files: [
        { path: 'a.cir', content: '* test' },
        { path: 'x.lib', content: '* model' },
      ],
      entry: 'a.cir',
      active: 'x.lib',
      config: { type: 'op' },
      configMode: 'auto',
      custom: [{ id: 'r100' }],
    };
    const saved = projectJson(readProject(data));
    expect(saved).toEqual({ ...data, schemaVersion: 3 });
    expect(saved).not.toHaveProperty('id');
  });
});
