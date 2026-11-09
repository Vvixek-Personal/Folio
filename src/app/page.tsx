import { Dashboard } from "@/components/dashboard";
import { Welcome } from "@/components/welcome";
import { InvitationLanding } from "@/components/invitation-landing";
import { getSessionUser, getSessionUserFromToken } from "@/lib/auth";
import { ensureWorkspaceForUser, getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ invite?: string | string[]; session?: string | string[]; ws?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [cookieUser, params] = await Promise.all([getSessionUser(), searchParams]);
  const rawInvite = first(params.invite);
  const inviteToken = typeof rawInvite === "string" ? rawInvite.slice(0, 128) : null;
  const rawSession = first(params.session);
  const sessionParam = typeof rawSession === "string" && /^[a-f0-9]{64}$/.test(rawSession) ? rawSession : null;
  const rawWorkspace = first(params.ws);
  const workspaceParam = typeof rawWorkspace === "string" ? rawWorkspace.slice(0, 36) : null;

  // The cookie is preferred. When a browser blocks third-party cookies the
  // client passes its session token once so this render can succeed anyway.
  const user = cookieUser ?? (await getSessionUserFromToken(sessionParam));

  if (!user) return <Welcome inviteToken={inviteToken} />;
  if (inviteToken) return <InvitationLanding token={inviteToken} user={user} />;

  const workspace = await ensureWorkspaceForUser(user.id, user.name, workspaceParam);
  const snapshot = await getWorkspaceSnapshot(workspace.id);
  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-stone-500">Your workspace is getting ready. Refresh in a moment.</p>
      </main>
    );
  }

  return (
    <Dashboard
      initialData={snapshot}
      initialUser={user}
      isAuthenticated
      initialSessionToken={sessionParam ?? undefined}
      initialWorkspaceId={workspace.id}
    />
  );
}
