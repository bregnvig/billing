import { describe, expect, it } from 'vitest';
import type { Project, Task } from './entities';
import { defaultHoursProblem, projectNameProblem, taskNameProblem, toDefaultHours } from './projects';

const audit = { archived: false, createdAt: new Date(0), updatedAt: new Date(0) };
const projects: Project[] = [{ id: 'a', name: 'Acme', color: 'blue', ...audit }];
const tasks: Task[] = [{ id: 't', projectId: 'a', name: 'API', defaultHours: null, ...audit }];

describe('project and task validation', () => {
  it('requires a name of at most 60 characters', () => {
    expect(projectNameProblem('  ', projects)).toBe('required');
    expect(projectNameProblem('x'.repeat(61), projects)).toBe('tooLong');
    expect(projectNameProblem('Billing', projects)).toBeNull();
  });

  it('refuses duplicate names, ignoring case and spaces, except for the item itself', () => {
    expect(projectNameProblem(' acme ', projects)).toBe('duplicate');
    expect(projectNameProblem('ACME', projects, 'a')).toBeNull();
    expect(taskNameProblem('api', 'a', tasks)).toBe('duplicate');
    expect(taskNameProblem('api', 'other-project', tasks)).toBeNull();
    expect(taskNameProblem('API', 'a', tasks, 't')).toBeNull();
  });

  it('accepts no default hours, or both ends with the end after the start', () => {
    expect(defaultHoursProblem(null, null)).toBeNull();
    expect(defaultHoursProblem(480, null)).toBe('incomplete');
    expect(defaultHoursProblem(960, 480)).toBe('endBeforeStart');
    expect(defaultHoursProblem(480, 960)).toBeNull();
    expect(toDefaultHours(480, 960)).toEqual({ start: 480, end: 960 });
    expect(toDefaultHours(null, null)).toBeNull();
  });
});
