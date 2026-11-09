export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: string;
}

export interface WorkspacePage {
  id: string;
  title: string;
  icon: string;
  cover: string;
  content: string;
  isFavorite: boolean;
  updatedAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  workspace: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
  members: WorkspaceMember[];
  pages: WorkspacePage[];
  tasks: WorkspaceTask[];
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  isGuest: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  avatarColor: string;
  body: string;
  createdAt: string;
}
