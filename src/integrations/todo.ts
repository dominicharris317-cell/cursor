import { TodoistApi } from '@doist/todoist-api-typescript';
import { config } from '../config';
import { ExtractedIntent } from '../store/sessionStore';

export async function createTodoistTasks(intents: ExtractedIntent[]) {
  if (!config.todoist.apiToken) {
    return { created: 0, skipped: intents.length, reason: 'No TODOIST_API_TOKEN' };
  }
  const api = new TodoistApi(config.todoist.apiToken);
  let created = 0;
  for (const intent of intents) {
    if (intent.type !== 'create_todo') continue;
    const content = intent.title || intent.description || 'New task';
    const dueString = intent.whenStartIso ? new Date(intent.whenStartIso).toISOString() : undefined;
    try {
      await api.addTask({ content, description: intent.description, dueDate: dueString });
      created++;
    } catch (e) {
      // ignore individual failures
    }
  }
  return { created, skipped: intents.length - created };
}