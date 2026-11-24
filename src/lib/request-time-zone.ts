import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import {
  browserTimeZone,
  IP_TIME_ZONE_HEADER,
  pickTimeZone,
  TIME_ZONE_COOKIE,
} from "~/lib/time-zone";

/**
 * The zone to render in. On the server, the best guess from the request (`~/lib/time-zone` says
 * in what order); in the browser, the browser's own.
 */
export const getRequestTimeZone = createIsomorphicFn()
  .server(() => pickTimeZone(getCookie(TIME_ZONE_COOKIE), getRequestHeader(IP_TIME_ZONE_HEADER)))
  .client(() => browserTimeZone());
