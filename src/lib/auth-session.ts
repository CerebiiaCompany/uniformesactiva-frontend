import { jwtDecode } from "jwt-decode";

interface JwtExpPayload {
    exp?: number;
}

/** Margen (segundos) para tratar el token como expirado antes del `exp` real. */
const EXPIRY_SKEW_SECONDS = 30;

export function isAccessTokenExpired(token: string | null | undefined): boolean {
    if (!token) return true;

    try {
        const { exp } = jwtDecode<JwtExpPayload>(token);
        if (!exp) return true;
        const nowSeconds = Math.floor(Date.now() / 1000);
        return exp <= nowSeconds + EXPIRY_SKEW_SECONDS;
    } catch {
        return true;
    }
}

export function getStoredAccessToken(): string | null {
    return localStorage.getItem("token");
}

export function clearAuthSession(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}
