import { Navigate, Outlet, useLocation } from "react-router-dom";
import { clearAuthSession, getStoredAccessToken, isAccessTokenExpired } from "@/lib/auth-session";

export default function ProtectedRoute() {
    const location = useLocation();
    const token = getStoredAccessToken();
    const userJson = localStorage.getItem("user");

    if (!token || isAccessTokenExpired(token)) {
        clearAuthSession();
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    let userRoles: string[] = [];
    let userPermissions: Array<{ module?: string; actions?: string[] }> = [];

    if (userJson) {
        try {
            const userData = JSON.parse(userJson);
            userRoles = userData.roles || [];
            userPermissions = userData.permissions || [];
        } catch (e) {
            console.error("Error al parsear el objeto user en ProtectedRoute:", e);
            clearAuthSession();
            return <Navigate to="/login" replace state={{ from: location }} />;
        }
    }

    if (location.pathname.startsWith("/administration")) {
        const hasAdminPermission = userPermissions.some(
            (perm) => perm.module === "users" && perm.actions?.includes("read"),
        );
        if (!userRoles.includes("Administrador") && !hasAdminPermission) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
}
