export const REPO_URL = "https://github.com/Parametricall/hot_shots";

/** Where a repo-relative path lives on GitHub, at `main`. */
export const githubBlobUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;

/** The folder of Architecture Decision Records, and one record in it. */
export const ADR_FOLDER_URL = githubBlobUrl("docs/adr");
export const adrUrl = (file: string) => githubBlobUrl(`docs/adr/${file}`);
