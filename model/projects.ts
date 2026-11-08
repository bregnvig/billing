/** Validation for projects and tasks. Pure, shared by the UI (and any future server code). */
import type { DefaultHours, Project, Task } from './entities';

export const NAME_MAX = 60;

export type NameProblem = 'required' | 'tooLong' | 'duplicate';

const normal = (name: string) => name.trim().toLocaleLowerCase();

/** Problem with a project name, or null. `exceptId` skips the project being renamed. */
export const projectNameProblem = (name: string, projects: readonly Project[], exceptId?: string): NameProblem | null => {
  if (!name.trim()) return 'required';
  if (name.trim().length > NAME_MAX) return 'tooLong';
  return projects.some(p => p.id !== exceptId && normal(p.name) === normal(name)) ? 'duplicate' : null;
};

/** Problem with a task name within its project, or null. */
export const taskNameProblem = (name: string, projectId: string, tasks: readonly Task[], exceptId?: string): NameProblem | null => {
  if (!name.trim()) return 'required';
  if (name.trim().length > NAME_MAX) return 'tooLong';
  return tasks.some(t => t.projectId === projectId && t.id !== exceptId && normal(t.name) === normal(name)) ? 'duplicate' : null;
};

export type HoursProblem = 'incomplete' | 'endBeforeStart';

/** Default hours are optional, but need both ends, with the end after the start. */
export const defaultHoursProblem = (start: number | null, end: number | null): HoursProblem | null => {
  if (start === null && end === null) return null;
  if (start === null || end === null) return 'incomplete';
  return end > start ? null : 'endBeforeStart';
};

export const toDefaultHours = (start: number | null, end: number | null): DefaultHours | null =>
  start !== null && end !== null && end > start ? { start, end } : null;
