export const APPS = [
  {
    id: "afl-tipping",
    name: "AFL Tipping",
    description: "Submit your tips and track your predictions.",
    href: "/afl-tipping/tips",
    icon: "/dummy-footy-logo.png",
  },
] as const;

export type AppId = (typeof APPS)[number]["id"];
