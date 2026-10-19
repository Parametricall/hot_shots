# Releasing the Demo

The Demo (`docs/adr/0004`) is public, so a push to `main` doesn't reach it. Its Vercel project
tracks the `demo` branch as its production branch, and moving `demo` forward is the release.
Production still deploys from `main` as before. Both projects read the same `vercel.json`, so
this setting lives in the Demo project's dashboard (**Settings → Environments → Production →
Branch Tracking**), not in the repo.

## Release

1. Check the commit as the Demo: `npm run dev:demo`, then play a few Games forward with the Time
   control. Check the preview deployment instead, if the Demo project builds previews.
2. Fast-forward `demo` to it:

   ```bash
   git push origin main:demo     # or <sha>:demo for an earlier commit
   ```

   Git refuses anything other than a fast-forward, so this can't drop a commit already released.

## Roll back

- **Quick:** in the Demo project, pick an earlier production deployment and choose **Instant
  Rollback**. Vercel stops auto-assigning the domain until you promote a deployment again.
- **In git:** `git push --force-with-lease origin <good-sha>:demo` moves the branch back and
  redeploys that commit. This is the one force-push the branch should see.

Never commit to `demo` directly. It only ever points at a commit already on `main`.
