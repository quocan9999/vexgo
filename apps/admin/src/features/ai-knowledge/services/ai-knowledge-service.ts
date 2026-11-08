import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  AiKnowledgeDocumentItem,
  CreateKnowledgeDocumentInput,
  PaginatedKnowledgeDocuments,
  QueryKnowledgeDocumentsParams,
  UpdateKnowledgeDocumentInput,
} from '../types/ai-knowledge';

export class AiKnowledgeApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiKnowledgeApiError';
  }
}

function getDocumentsApiUrl(path = '') {
  return `${getApiBaseUrl()}/api/v1/ai-chatbot/admin/documents${path}`;
}

function getChatbotApiUrl(path = '') {
  return `${getApiBaseUrl()}/api/v1/ai-chatbot${path}`;
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      json?.message ||
      json?.error ||
      `Yêu cầu thất bại với mã trạng thái ${response.status}.`;
    throw new AiKnowledgeApiError(message, json?.error, response.status);
  }

  return json as T;
}

export async function getKnowledgeDocuments(
  params: QueryKnowledgeDocumentsParams = {},
  signal?: AbortSignal,
): Promise<PaginatedKnowledgeDocuments> {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) searchParams.set('page', String(params.page));
  if (params.pageSize !== undefined)
    searchParams.set('pageSize', String(params.pageSize));
  if (params.search) searchParams.set('search', params.search);
  if (params.keyword) searchParams.set('keyword', params.keyword);
  if (params.category) searchParams.set('category', params.category);
  if (params.scope) searchParams.set('scope', params.scope);
  if (params.nhaXeId !== undefined)
    searchParams.set('nhaXeId', String(params.nhaXeId));
  if (params.isActive !== undefined)
    searchParams.set('isActive', String(params.isActive));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortDirection)
    searchParams.set('sortDirection', params.sortDirection);

  const query = searchParams.toString();
  const url = getDocumentsApiUrl(query ? `?${query}` : '');

  const response = await adminApiFetch(url, { signal });
  return handleApiResponse<PaginatedKnowledgeDocuments>(response);
}

export async function getKnowledgeDocumentDetail(
  id: number,
  signal?: AbortSignal,
): Promise<AiKnowledgeDocumentItem> {
  const response = await adminApiFetch(getDocumentsApiUrl(`/${id}`), {
    signal,
  });
  const json = await handleApiResponse<{ data: AiKnowledgeDocumentItem }>(response);
  return json.data;
}

export async function createKnowledgeDocument(
  input: CreateKnowledgeDocumentInput,
): Promise<AiKnowledgeDocumentItem> {
  const response = await adminApiFetch(getDocumentsApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await handleApiResponse<{ data: AiKnowledgeDocumentItem }>(response);
  return json.data;
}

export async function updateKnowledgeDocument(
  id: number,
  input: UpdateKnowledgeDocumentInput,
): Promise<AiKnowledgeDocumentItem> {
  const response = await adminApiFetch(getDocumentsApiUrl(`/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await handleApiResponse<{ data: AiKnowledgeDocumentItem }>(response);
  return json.data;
}

export async function toggleKnowledgeDocumentStatus(
  id: number,
): Promise<AiKnowledgeDocumentItem> {
  const response = await adminApiFetch(getDocumentsApiUrl(`/${id}/status`), {
    method: 'PATCH',
  });
  const json = await handleApiResponse<{ data: AiKnowledgeDocumentItem }>(response);
  return json.data;
}

export async function deleteKnowledgeDocument(
  id: number,
): Promise<{ success: boolean; message: string }> {
  const response = await adminApiFetch(getDocumentsApiUrl(`/${id}`), {
    method: 'DELETE',
  });
  const json = await handleApiResponse<{ data: { success: boolean; message: string } }>(
    response,
  );
  return json.data;
}

export interface AiChatTestResponse {
  sessionToken: string;
  reply: string;
  intent: string;
  citations: Array<{
    documentCode: string;
    title: string;
    hierarchyPath: string;
    relevanceScore: number;
  }>;
  suggestedTrips?: unknown[];
  requiresHumanHandoff: boolean;
  handoffReason?: string;
}

export async function sendTestChatMessage(
  message: string,
  sessionToken?: string,
): Promise<AiChatTestResponse> {
  const response = await adminApiFetch(getChatbotApiUrl('/messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionToken }),
  });
  const json = await handleApiResponse<Record<string, unknown>>(response);
  const data = (
    json && typeof json === 'object' && 'data' in json && json.data
      ? json.data
      : json
  ) as AiChatTestResponse;
  return data;
}
