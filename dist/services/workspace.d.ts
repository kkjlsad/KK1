export declare function editTextFile(target: string, find: string, replace: string, all: boolean): Promise<Record<string, unknown>>;
export declare function deletePath(target: string, recursive: boolean, confirm: string): Promise<Record<string, unknown>>;
export declare function movePath(from: string, to: string): Promise<Record<string, unknown>>;
export declare function searchFiles(root: string, namePattern: string | undefined, contentPattern: string | undefined, maxResults: number): Promise<Record<string, unknown>>;
