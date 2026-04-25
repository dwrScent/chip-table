export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

interface ApiFailure {
  ok: false;
  error: ApiErrorPayload;
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiClientError extends Error {
  public readonly code: string;

  constructor(message: string, code = "UNKNOWN") {
    super(message);
    this.code = code;
  }
}

async function parseJson<T>(response: Response): Promise<ApiResponse<T>> {
  const data = (await response.json()) as ApiResponse<T>;
  return data;
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new ApiClientError("网络连接失败，请检查服务是否在线", "NETWORK_ERROR");
  }

  const payload = await parseJson<T>(response);

  if (!payload.ok) {
    throw new ApiClientError(payload.error.message, payload.error.code);
  }

  return payload.data;
}
