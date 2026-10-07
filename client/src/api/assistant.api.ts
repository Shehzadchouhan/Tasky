import { apiClient } from './client.ts';

export interface AssistantReply {
  message: string;
  pendingDelete?: {
    taskId: string;
    title: string;
  };
}

export interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

export const assistantApi = {
  chat: (message: string, history: AssistantHistoryMessage[], timezone?: string) =>
    apiClient<AssistantReply>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }),

  confirmDelete: (taskId: string) =>
    apiClient<{ ok: boolean }>('/assistant/confirm-delete', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }),
};
