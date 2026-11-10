import { db } from "@/db";
import { activity } from "@/db/schema";

export type ActivityType =
  | "page_created"
  | "page_updated"
  | "page_deleted"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_deleted"
  | "comment_added"
  | "member_joined"
  | "member_removed"
  | "workspace_renamed"
  | "drive_connected"
  | "project_created"
  | "project_updated"
  | "project_shipped"
  | "event_created"
  | "event_updated"
  | "library_saved"
  | "goal_created"
  | "goal_updated"
  | "goal_completed"
  | "decision_logged"
  | "ritual_created"
  | "ritual_kept"
  | "focus_logged"
  | "studio_removed";

export interface ActivityRecord {
  workspaceId: string;
  actorId: string;
  type: ActivityType;
  targetType?: "page" | "task" | "member" | "workspace" | null;
  targetId?: string | null;
  summary?: string | null;
  detail?: string | null;
}

/**
 * Appends a row to the workspace activity feed. Fire-and-forget by design:
 * recording an event must never block or fail the primary mutation, and the
 * summary captures the item's name at the moment it happened so deleted
 * items still read well in the timeline.
 */
export async function recordActivity(input: ActivityRecord) {
  try {
      await db.insert(activity).values({
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        type: input.type,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        summary: input.summary ? input.summary.slice(0, 180) : null,
        detail: input.detail ? input.detail.slice(0, 240) : null,
      });
  } catch {
    /* Activity is best-effort. */
  }
}
