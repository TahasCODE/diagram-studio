import { parseDiagram } from './model';
import type { Diagram } from './model';

export interface Account { id: string; name: string; email: string }
export interface Draft { id: string; version: number; updatedAt: string; document: Diagram }
export interface ProjectSummary { id: string; title: string; version: number; updatedAt: string }
export interface PublicationSummary { id: string; title: string; createdAt: string }
export interface Publication extends PublicationSummary { document: Diagram }
export interface RevisionSummary { version: number; title: string; createdAt: string }
export interface Revision extends RevisionSummary { document: Diagram }
export interface PageResponse<T> { items: T[]; page: number; size: number; total: number; totalPages: number }
export interface AuditEvent { id: number; projectId: string; action: string; version: number | null; createdAt: string; requestId: string | null }
export class ApiError extends Error { constructor(public status: number, message: string,public requestId?: string) { super(message); } }
let csrfToken = '';
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method, credentials: 'same-origin', signal: AbortSignal.timeout(15000),
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-TOKEN': csrfToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiError(0, 'Cannot reach project storage. Your local work is still available.'); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || error.detail || 'The request could not be completed.',error.requestId || response.headers.get('X-Request-ID') || undefined);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
export async function session() {
  const data = await request<{ user: Account | null; csrfToken: string }>('/auth/me');
  csrfToken = data.csrfToken;
  return data.user;
}
export async function saveProject(document: Diagram, active: {id: string; version: number} | null): Promise<Draft> {
  const draft = await request<Draft>(active ? '/projects/' + active.id : '/projects', active ? 'PUT' : 'POST', { document, ...(active ? { version: active.version } : {}) });
  return { ...draft, document: parseDiagram(draft.document) };
}
