import { dbOperations } from '../db/index.js';
import type { TaskSchedule } from '@lofiaistudio/shared';
import { computeNextRunAt } from './cronParser.js';

export function startTaskScheduler(port: string | number) {
  const runDueTasks = async () => {
    const tasks = dbOperations.getCollection<TaskSchedule>('tasks');
    const due = tasks.filter(
      (task) => task.enabled && task.workflowId && task.nextRunAt && Date.parse(task.nextRunAt) <= Date.now()
    );

    for (const task of due) {
      dbOperations.updateInCollection<TaskSchedule>('tasks', task.id, {
        nextRunAt: computeNextRunAt(task.cron),
        updatedAt: new Date().toISOString(),
      });

      try {
        await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: { scheduled: true } }),
        });
      } catch (error) {
        console.error(`Scheduled task failed: ${task.name}`, error);
      }
    }
  };

  const id = setInterval(runDueTasks, 60_000);
  void runDueTasks();
  return () => clearInterval(id);
}