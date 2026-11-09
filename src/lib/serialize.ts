import type { pages, tasks } from "@/db/schema";
import type { TaskPriority, TaskStatus } from "@/lib/types";

type PageRow = typeof pages.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;

export function serializePage(page: PageRow) {
  return {
    id: page.id,
    title: page.title,
    icon: page.icon,
    cover: page.cover,
    content: page.content,
    isFavorite: page.isFavorite === "true",
    updatedAt: page.updatedAt.toISOString(),
  };
}

export function serializeTask(task: TaskRow) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    project: task.project,
    dueDate: task.dueDate,
    assigneeId: task.assigneeId,
    assigneeName: null,
    assigneeColor: null,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
