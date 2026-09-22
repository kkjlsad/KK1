export type GitAction = "status" | "diff" | "log" | "branch" | "remote" | "show" | "rev-parse" | "add" | "commit" | "push" | "pull" | "fetch" | "stash";
export declare function gitAction(repository: string, action: GitAction, args: string[], message?: string): Promise<Record<string, unknown>>;
export declare function cloneRepo(url: string, destination: string, depth: number): Promise<Record<string, unknown>>;
