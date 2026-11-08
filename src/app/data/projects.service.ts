import { inject, Injectable } from '@angular/core';
import { COLLECTIONS, DefaultHours, Project, ProjectColor, Task } from '@loopme/model';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { PROJECT_COLORS } from '../ui/marker';
import { projectsCollection, tasksCollection } from './collections';

export type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'archived'>>;
export type TaskPatch = Partial<Pick<Task, 'name' | 'defaultHours' | 'archived'>>;

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

  readonly updateProject = (id: string, patch: ProjectPatch): Promise<void> =>
    updateDoc(doc(collection(this.#db, COLLECTIONS.projects), id), {
      ...patch,
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      updatedAt: serverTimestamp(),
    });

  readonly createTask = async (projectId: string, name: string, defaultHours: DefaultHours | null): Promise<Task> => {
    const now = new Date();
    const task: Task = { id: '', projectId, name: name.trim(), defaultHours, archived: false, createdAt: now, updatedAt: now };
    const ref = await addDoc(tasksCollection(this.#db), task);
    return { ...task, id: ref.id };
  };

  readonly updateTask = (id: string, patch: TaskPatch): Promise<void> =>
    updateDoc(doc(collection(this.#db, COLLECTIONS.tasks), id), {
      ...patch,
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      updatedAt: serverTimestamp(),
    });
}
