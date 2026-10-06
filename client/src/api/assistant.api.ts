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
  chat: (message: string, history: AssistantHistoryMessage[]) =>
    apiClient<AssistantReply>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),

  confirmDelete: (taskId: string) =>
    apiClient<{ message: string }>('/assistant/confirm-delete', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    }),
};
