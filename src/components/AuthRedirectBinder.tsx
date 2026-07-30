import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { registerUnauthorizedHandler, resetAuthRedirectGuard } from "@/lib/auth-redirect";

/** Conecta http.ts con React Router para redirigir al login al expirar la sesión. */
export function AuthRedirectBinder() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        resetAuthRedirectGuard();

        return registerUnauthorizedHandler(() => {
            queryClient.clear();
            navigate("/login", { replace: true });
        });
    }, [navigate, queryClient]);

    return null;
}
