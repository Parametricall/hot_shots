# Every App lives under a path on one origin, served by one Vercel project

The Hub and every App are one TanStack Start site on `hot-shots.dev`, each App under its own path
(`/afl-tipping/`), not on its own subdomain. A PWA's `scope` must be same-origin, so the installed
Hub can only keep an App inside its window if the App shares its origin. On a subdomain, tapping
an App leaves the Hub: iOS opens a Safari sheet with its own cookie jar (and possibly a second
sign-in), Android a Custom Tab.

Each App is still installable on its own: the browser installs whichever manifest the current
page links, so each App's routes link the App's own manifest from their `head()` (AFL keeps
`/site.webmanifest`, the URL it had before the Hub), and the Hub links `/hub.webmanifest`. Nested
scopes on one origin are fine as long as the `id`s differ. One service worker (`/sw.js`, scope
`/`) serves every install.

## Considered options

| Option                                        | Why not                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One subdomain per App                         | Leaves the installed Hub on every App tap (see above). Built, then unwound                                                                                                  |
| One Vercel project per App, Microfrontends    | Includes only 2 projects on Hobby/Pro (a 3rd isn't available on Hobby and is a paid add-on on Pro), Hobby caps routed requests, and TanStack Start isn't a listed framework |
| One project per App, joined by proxy rewrites | Puts Clerk behind a proxy (host-mismatch risk) and adds a hop to every request                                                                                              |
| One project, path-based Apps                  | Chosen: a new App costs a route subtree and a manifest                                                                                                                      |

## Consequences

- The installed AFL PWA's `id` (`/afl-tipping/tips`), `scope` (`/afl-tipping/`) and manifest URL
  (`/site.webmanifest`) must never change: Android's WebAPK update checks key off the manifest
  URL, and a new `id` is a different app to the browser, so existing installs would break.
- On iOS every home-screen web app has its own storage and cookies, so a Tipster with both the Hub
  and the AFL app installed signs in to each once. True under any of the options.
