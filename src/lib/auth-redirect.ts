type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
    unauthorizedHandler = handler;
    return () => {
        if (unauthorizedHandler === handler) {
            unauthorizedHandler = null;
        }
    };
}

export function clearSessionAndRedirectToLogin(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    if (unauthorizedHandler) {
        unauthorizedHandler();
        return;
    }

    // Fallback: "/" siempre existe en Vercel; evita 404 si /login no tiene rewrite aún.
    window.location.replace("/");
}
