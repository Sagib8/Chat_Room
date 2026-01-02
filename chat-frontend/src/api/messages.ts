import { http } from "./http";

export type Message = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
};

export type ListMessagesParams = {
  search?: string;
  limit?: number;
  from?: string;
  to?: string;
};

export async function listMessages(params?: ListMessagesParams) {
  const res = await http.get<{ messages: Message[] }>("/messages", { params });
  return res.data.messages;
}

export async function createMessage(content: string) {
  const res = await http.post<{ message: Message }>("/messages", { content });
  return res.data.message;
}
export async function updateMessage(id: string, content: string) {
  const res = await http.put<{ message: Message }>(`/messages/${id}`, { content });
  return res.data.message;
}

export async function deleteMessage(id: string) {
  await http.delete(`/messages/${id}`);
}
