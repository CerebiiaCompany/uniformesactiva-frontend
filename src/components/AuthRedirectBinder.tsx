import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { registerUnauthorizedHandler } from "@/lib/auth-redirect";

/** Conecta http.ts con React Router para redirigir sin recargar la página. */
export function AuthRedirectBinder() {
    const navigate = useNavigate();

    useEffect(() => {
        return registerUnauthorizedHandler(() => {
            navigate("/login", { replace: true });
        });
    }, [navigate]);

    return null;
}
