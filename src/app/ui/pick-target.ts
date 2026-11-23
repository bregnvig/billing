import { Assignment, Project, Task } from '@loopme/model';
import { PickerResult } from './project-picker';

/**
 * Where a project-picker choice assigns to, and its name for the toast (`Project / Task`).
 * "Create project" creates it first with `create`.
 */
export const pickTarget = async (
  result: PickerResult,
  projects: readonly Project[],
  tasks: readonly Task[],
  create: (name: string) => Promise<Project>,
): Promise<{ target: Assignment; name: string }> => {
  if ('createProject' in result) {
    const project = await create(result.createProject);
    return { target: { projectId: project.id, taskId: null }, name: project.name };
  }
  const target = result.assign;
  const project = projects.find(p => p.id === target.projectId);
  const task = tasks.find(t => t.id === target.taskId);
  return { target, name: project ? (task ? `${project.name} / ${task.name}` : project.name) : '' };
};
