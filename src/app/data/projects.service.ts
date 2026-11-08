import { inject, Injectable } from '@angular/core';
import { Project, ProjectColor, Task } from '@loopme/model';
import { addDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { PROJECT_COLORS } from '../ui/marker';
import { projectsCollection, tasksCollection } from './collections';

/** Writes to projects and tasks. Read them with `liveProjects()` / `liveTasks()`. */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  readonly #db = inject(FIRESTORE);

  /** Creates a project with the first palette color not used yet (cycling when all are). */
  readonly createProject = async (name: string, existing: readonly Project[]): Promise<Project> => {
    const used = new Set(existing.map(p => p.color));
    const color: ProjectColor = PROJECT_COLORS.find(c => !used.has(c)) ?? PROJECT_COLORS[existing.length % PROJECT_COLORS.length];
    const now = new Date();
    const project: Project = { id: '', name: name.trim(), color, archived: false, createdAt: now, updatedAt: now };
    const ref = await addDoc(projectsCollection(this.#db), project);
    return { ...project, id: ref.id };
  };

  readonly createTask = async (projectId: string, name: string): Promise<Task> => {
    const now = new Date();
    const task: Task = { id: '', projectId, name: name.trim(), archived: false, createdAt: now, updatedAt: now };
    const ref = await addDoc(tasksCollection(this.#db), task);
    return { ...task, id: ref.id };
  };
}
