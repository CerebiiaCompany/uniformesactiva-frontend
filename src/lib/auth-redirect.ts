import { clearAuthSession } from "@/lib/auth-session";

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let redirectInProgress = false;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
    unauthorizedHandler = handler;
    return () => {
        if (unauthorizedHandler === handler) {
            unauthorizedHandler = null;
        }
    };
}

/** Limpia la sesión y redirige al login una sola vez (evita carreras por varios 401). */
export function clearSessionAndRedirectToLogin(): void {
    if (redirectInProgress) return;
    redirectInProgress = true;

    clearAuthSession();

    try {
        if (unauthorizedHandler) {
            unauthorizedHandler();
            return;
        }
    } catch (error) {
        console.error("Error al redirigir al login:", error);
    }

    // Fallback hard navigation si el binder de React Router no está montado.
    window.location.replace("/login");
}

export function resetAuthRedirectGuard(): void {
    redirectInProgress = false;
}
