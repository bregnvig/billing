import { Project, Task } from '@loopme/model';
import { pickerOptions } from './project-picker';

const project = (id: string, name: string, archived = false): Project => ({
  id,
  name,
  color: null,
  archived,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const task = (id: string, projectId: string, name: string): Task => ({
  id,
  projectId,
  name,
  defaultHours: null,
  archived: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const projects = [project('a', 'Acme'), project('b', 'Billing'), project('old', 'Old stuff', true)];
const tasks = [task('t1', 'a', 'API'), task('t2', 'a', 'Design'), task('t3', 'b', 'Invoices')];
const labels = (q: string, unassign = true) =>
  pickerOptions(projects, tasks, q, unassign).map(o =>
    o.kind === 'unassign'
      ? 'Unassigned'
      : o.kind === 'project'
        ? o.project.name
        : o.kind === 'task'
          ? `${o.project.name}/${o.task.name}`
          : `+${o.name}`,
  );

describe('pickerOptions', () => {
  it('lists Unassigned, then projects with their tasks, without archived ones', () => {
    expect(labels('')).toEqual(['Unassigned', 'Acme', 'Acme/API', 'Acme/Design', 'Billing', 'Billing/Invoices']);
    expect(labels('', false)[0]).toBe('Acme');
  });

  it('filters by project or task name and offers to create a new project', () => {
    expect(labels('acm')).toEqual(['Acme', 'Acme/API', 'Acme/Design', '+acm']);
    expect(labels('invo')).toEqual(['Billing', 'Billing/Invoices', '+invo']);
    expect(labels('Loopme')).toEqual(['+Loopme']);
  });

  it("doesn't offer to create a project that already exists", () => {
    expect(labels('billing')).toEqual(['Billing', 'Billing/Invoices']);
  });
});
