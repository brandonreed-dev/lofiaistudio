import type { Request, Response, Router } from 'express';
import type {
  ActivityEvent,
  Agent,
  ApiResponse,
  Integration,
  Model,
  Project,
  RuntimeType,
  Skill,
  TaskSchedule,
  Webhook,
  Workflow,
  WorkflowRun,
} from '@lofiaistudio/shared';
import { v4 as uuidv4 } from 'uuid';
import type { AdapterRegistry } from '../../adapters/index.js';
import type { AudioAdapter, VideoAdapter } from '../../adapters/base.js';
import { dbOperations } from '../../db/index.js';

export type CrudCollection =
  | 'agents'
  | 'workflows'
  | 'skills'
  | 'tasks'
  | 'projects'
  | 'integrations'
  | 'webhooks';

export type CrudEntity =
  | Agent
  | Workflow
  | Skill
  | TaskSchedule
  | Project
  | Integration
  | Webhook;

export interface ApiRouterContext {
  router: Router;
  adapterRegistry: AdapterRegistry;
  now: () => string;
  respond: <T>(res: Response, data: T, status?: number) => Response;
  fail: (res: Response, error: unknown, status?: number) => Response;
  addActivity: (
    event: Omit<ActivityEvent, 'id' | 'createdAt'> & Partial<Pick<ActivityEvent, 'id' | 'createdAt'>>
  ) => ActivityEvent;
  createCrudRoutes: <T extends CrudEntity>(path: string, collection: CrudCollection) => void;
  runWorkflow: (
    workflow: Workflow,
    trigger: WorkflowRun['trigger'],
    input?: Record<string, unknown>
  ) => Promise<WorkflowRun>;
  getAudioModel: (modelId: string, runtime?: RuntimeType) => Promise<{ adapter: AudioAdapter; model: Model } | undefined>;
  getVideoModel: (modelId: string, runtime?: RuntimeType) => Promise<{ adapter: VideoAdapter; model: Model } | undefined>;
}

export function createApiRouteHelpers(router: Router) {
  const now = () => new Date().toISOString();

  const respond = <T>(res: Response, data: T, status = 200) => {
    const response: ApiResponse<T> = { success: true, data };
    return res.status(status).json(response);
  };

  const fail = (res: Response, error: unknown, status = 500) => {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    return res.status(status).json(response);
  };

  const addActivity = (
    event: Omit<ActivityEvent, 'id' | 'createdAt'> & Partial<Pick<ActivityEvent, 'id' | 'createdAt'>>
  ): ActivityEvent => {
    const activity: ActivityEvent = {
      id: event.id ?? uuidv4(),
      createdAt: event.createdAt ?? now(),
      type: event.type,
      title: event.title,
      message: event.message,
      tone: event.tone,
      entityType: event.entityType,
      entityId: event.entityId,
    };
    dbOperations.addToCollection('activity', activity);
    return activity;
  };

  const createCrudRoutes = <T extends CrudEntity>(path: string, collection: CrudCollection) => {
    router.get(path, (_req: Request, res: Response) => {
      respond(res, dbOperations.getCollection<T>(collection));
    });

    router.post(path, (req: Request, res: Response) => {
      const stamp = now();
      const entity = {
        ...req.body,
        id: req.body.id ?? uuidv4(),
        createdAt: req.body.createdAt ?? stamp,
        updatedAt: stamp,
      } as T;
      dbOperations.addToCollection(collection, entity);
      addActivity({
        type: `${collection}.created`,
        title: `${collection.slice(0, -1)} created`,
        message: `${entity.name} was created.`,
        tone: 'green',
        entityType: collection,
        entityId: entity.id,
      });
      respond(res, entity, 201);
    });

    router.put(`${path}/:id`, (req: Request, res: Response) => {
      const updated = dbOperations.updateInCollection<T>(collection, req.params.id, {
        ...req.body,
        updatedAt: now(),
      } as Partial<T>);
      if (!updated) return fail(res, `${collection} entry not found: ${req.params.id}`, 404);
      addActivity({
        type: `${collection}.updated`,
        title: `${collection.slice(0, -1)} updated`,
        message: `${updated.name} was updated.`,
        tone: 'purple',
        entityType: collection,
        entityId: updated.id,
      });
      respond(res, updated);
    });

    router.delete(`${path}/:id`, (req: Request, res: Response) => {
      const deleted = dbOperations.deleteFromCollection(collection, req.params.id);
      if (!deleted) return fail(res, `${collection} entry not found: ${req.params.id}`, 404);
      addActivity({
        type: `${collection}.deleted`,
        title: `${collection.slice(0, -1)} deleted`,
        message: `${req.params.id} was deleted.`,
        tone: 'amber',
        entityType: collection,
        entityId: req.params.id,
      });
      respond(res, true);
    });
  };

  return { now, respond, fail, addActivity, createCrudRoutes };
}
