import { clearSessionAndRedirectToLogin } from "@/lib/auth-redirect";
import { getStoredAccessToken, isAccessTokenExpired } from "@/lib/auth-session";

export class HttpError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

/** Error de sesión inválida/expirada; las UIs deben ignorarlo (ya se redirige al login). */
export class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

function parseErrorMessage(errorData: Record<string, unknown>, status: number, statusText: string): string {
    const nestedDetails = (errorData.error as { details?: Record<string, string[]> } | undefined)?.details;
    const detailFromNested =
        nestedDetails && typeof nestedDetails === "object"
            ? Object.values(nestedDetails).flat().join(" ")
            : null;

    const directDetail = typeof errorData.detail === "string" ? errorData.detail : null;
    if (directDetail) return directDetail;
    if (detailFromNested) return detailFromNested;

    const serializerErrors = Object.entries(errorData)
        .filter(([key]) => !["error", "message", "detail"].includes(key))
        .flatMap(([key, value]) => {
            if (Array.isArray(value)) return value.map((v) => `${key}: ${v}`);
            if (typeof value === "string") return [`${key}: ${value}`];
            return [];
        })
        .join(" ");

    if (serializerErrors) return serializerErrors;

    const fallback =
        (errorData.error as { message?: string } | undefined)?.message ||
        (typeof errorData.message === "string" ? errorData.message : null);

    return fallback || `Error ${status}: ${statusText}`;
}

export interface HttpOptions extends RequestInit {
    skipAuthRedirect?: boolean;
}

export async function http<T>(input: RequestInfo, init?: HttpOptions): Promise<T> {
    const token = getStoredAccessToken();

    if (token && isAccessTokenExpired(token)) {
        if (!init?.skipAuthRedirect) {
            clearSessionAndRedirectToLogin();
        }
        throw new UnauthorizedError("Sesión expirada");
    }

    const headers = new Headers(init?.headers || {});
    if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
        if (!init?.skipAuthRedirect) {
            clearSessionAndRedirectToLogin();
        }
        throw new HttpError("No autorizado para este recurso (401)", 401);
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new HttpError(
            parseErrorMessage(errorData as Record<string, unknown>, response.status, response.statusText),
            response.status,
        );
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const text = await response.text();
    if (!text.trim()) {
        return undefined as T;
    }

    return JSON.parse(text) as T;
}
