import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { grantRole, revokeRole } from "~/features/afl-tipping/api/user-roles";
import { setFeatureFlag } from "~/features/afl-tipping/api/feature-flags";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Shield, Users, Flag } from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";

const OWNER_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;

function UserManagementPanel() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery(aflQueries.usersWithRoles());

  const grantMutation = useMutation({
    mutationFn: (userId: string) => grantRole({ data: { userId, role: "admin" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aflQueries.usersWithRoles().queryKey });
      toast.success("Admin role granted");
    },
    onError: () => toast.error("Failed to grant role"),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => revokeRole({ data: { userId, role: "admin" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aflQueries.usersWithRoles().queryKey });
      toast.success("Admin role revoked");
    },
    onError: () => toast.error("Failed to revoke role"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y">
      {users?.map((user) => {
        const isAdmin = user.roles.includes("admin");
        const isOwner = user.userId === OWNER_USER_ID;
        const isPending = grantMutation.isPending || revokeMutation.isPending;
        return (
          <div key={user.userId} className="flex items-center gap-3 py-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {user.displayName[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && <Badge>Owner</Badge>}
              {isAdmin && !isOwner && <Badge variant="secondary">Admin</Badge>}
              {!isOwner && (
                <Button
                  variant={isAdmin ? "outline" : "default"}
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    isAdmin ? revokeMutation.mutate(user.userId) : grantMutation.mutate(user.userId)
                  }
                >
                  {isAdmin ? "Revoke Admin" : "Make Admin"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeatureFlagsPanel() {
  const queryClient = useQueryClient();
  const { data: flags, isLoading } = useQuery(aflQueries.allFeatureFlags());

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      setFeatureFlag({ data: { key, enabled } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aflQueries.allFeatureFlags().queryKey });
      // Also invalidate individual flag queries so leaderboard etc. pick up the change
      queryClient.invalidateQueries({ queryKey: aflQueries.aflKey() });
      toast.success("Feature flag updated");
    },
    onError: () => toast.error("Failed to update feature flag"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!flags || flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No feature flags configured.</p>;
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <div key={flag.key} className="flex items-center justify-between">
          <span className="font-mono text-sm">{flag.key}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
            className={cn("min-w-16", flag.enabled && "border-green-500 text-green-600")}
          >
            {flag.enabled ? "On" : "Off"}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function AdminPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserManagementPanel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureFlagsPanel />
        </CardContent>
      </Card>
    </div>
  );
}
