import { Navigate, Outlet, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

interface CustomJwtPayload {
    roles?: string[];
    [key: string]: any;
}

export default function ProtectedRoute() {
    const token = localStorage.getItem("token");
    const userJson = localStorage.getItem("user");
    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    let userRoles: string[] = [];
    let userPermissions: any[] = [];

    if (userJson) {
        try {
            const userData = JSON.parse(userJson);
            userRoles = userData.roles || [];
            userPermissions = userData.permissions || [];
        } catch (e) {
            console.error("Error al parsear el objeto user en ProtectedRoute:", e);
        }
    } else {
        try {
            const decoded = jwtDecode<CustomJwtPayload>(token);
            userRoles = decoded.roles || [];
            userPermissions = decoded.permissions || [];
        } catch (error) {
            console.error("Error al decodificar el token:", error);
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return <Navigate to="/login" replace state={{ from: location }} />;
        }
    }

    if (location.pathname.startsWith("/administration")) {
        const hasAdminPermission = userPermissions.some(
            (perm: any) => perm.module === "users" && perm.actions.includes("read")
        );
        if (!userRoles.includes("Administrador") && !hasAdminPermission) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
}