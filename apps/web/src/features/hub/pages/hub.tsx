import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { APPS } from "~/features/hub/apps";

export function HubPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center gap-8 p-6 pt-16 sm:pt-24"
      data-app-ready
    >
      <h1 className="text-3xl font-bold">Hot Shots</h1>
      <div className="grid w-full max-w-sm gap-4">
        {APPS.map((app) => (
          <Link key={app.id} to={app.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle>{app.name}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <img src={app.icon} alt="" className="w-12 h-12 rounded-lg" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
