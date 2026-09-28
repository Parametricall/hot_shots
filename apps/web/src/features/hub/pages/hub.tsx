import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { APPS, type AppId } from "~/features/hub/apps";
import { setLaunchApp } from "~/features/hub/api/launch-app";

const routeApi = getRouteApi("/");

export function HubPage() {
  const router = useRouter();
  const { launchAppId } = routeApi.useLoaderData();

  async function handleLaunchAppChange(appId: AppId, checked: boolean) {
    await setLaunchApp({ data: checked ? appId : null });
    await router.invalidate();
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center gap-8 p-6 pt-16 sm:pt-24"
      data-app-ready
    >
      <h1 className="text-3xl font-bold">Hot Shots</h1>
      <div className="grid w-full max-w-sm gap-4">
        {APPS.map((app) => (
          <Card key={app.id} className="transition-colors hover:border-primary/50">
            <Link to={app.href}>
              <CardHeader>
                <CardTitle>{app.name}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <img src={app.icon} alt="" className="w-12 h-12 rounded-lg" />
              </CardContent>
            </Link>
            <CardContent className="flex items-center justify-between gap-3 border-t pt-4">
              <label htmlFor={`launch-${app.id}`} className="text-sm text-muted-foreground">
                Open this app when I launch Hot Shots
              </label>
              <Switch
                id={`launch-${app.id}`}
                checked={launchAppId === app.id}
                onCheckedChange={(checked) => handleLaunchAppChange(app.id, checked)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
