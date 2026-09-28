import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import * as z from "zod";
import { APPS, type AppId } from "~/features/hub/apps";

const LAUNCH_APP_COOKIE = "hs_launch_app";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const LaunchAppInputSchema = z.union([
  z.enum(APPS.map((app) => app.id) as [AppId, ...AppId[]]),
  z.null(),
]);

export const getLaunchApp = createServerFn({ method: "GET" }).handler(() => {
  const id = getCookie(LAUNCH_APP_COOKIE);
  return APPS.find((app) => app.id === id) ?? null;
});

export const setLaunchApp = createServerFn({ method: "POST" })
  .validator(LaunchAppInputSchema)
  .handler(({ data }) => {
    if (data === null) {
      deleteCookie(LAUNCH_APP_COOKIE, { path: "/" });
      return;
    }
    setCookie(LAUNCH_APP_COOKIE, data, {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  });
