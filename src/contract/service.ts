/* service.ts — the data seam. A small fetch-shaped CRUD surface, MINUS any base
   path and any 401→login bounce (those become a consumer concern: the consumer
   wires `ctx.service = <its api>` and handles auth in a Guard). amenan-ui never
   imports a concrete Service — components read `ctx.service`. */

export interface ServiceError extends Error {
  status: number;
  body?: unknown;
}

export interface Service {
  get<T>(path: string, opts?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  upload<T>(path: string, file: File | FormData): Promise<T>;
}

/** A read-only async data source: a query in, typed rows out. Components that
    don't need full CRUD accept a `Source<T>` instead of the whole Service. */
export type Source<T> = (query?: Record<string, unknown>) => Promise<T>;
