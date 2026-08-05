import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { resetAuthRedirectGuard } from "@/lib/auth-redirect";
import { clearAuthSession, getStoredAccessToken, isAccessTokenExpired } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

const BASE_URL = getApiBaseUrl();

const pillars = ["Comercial", "Producción", "Inventario", "Costos"] as const;

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const isFormValid = username.trim().length > 0 && password.trim().length > 0;
    const isSubmitDisabled = loading || !isFormValid;

    useEffect(() => {
        resetAuthRedirectGuard();
        const token = getStoredAccessToken();
        if (!token) return;

        if (isAccessTokenExpired(token)) {
            clearAuthSession();
            return;
        }

        navigate("/dashboard", { replace: true });
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormValid) return;

        setLoading(true);

        try {
            const response = await fetch(`${BASE_URL}/api/v1/auth/token/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            });

            const raw = await response.text();
            let data: Record<string, unknown> = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    throw new Error(
                        response.ok
                            ? "Respuesta inválida del servidor de autenticación."
                            : "Usuario o contraseña incorrectos.",
                    );
                }
            }

            if (!response.ok) {
                const detail = typeof data.detail === "string" ? data.detail : null;
                throw new Error(detail || "Usuario o contraseña incorrectos.");
            }

            const token = (data.access || data.token) as string | undefined;

            if (token) {
                resetAuthRedirectGuard();
                localStorage.setItem("token", token);

                const userResponse = await fetch(`${BASE_URL}/api/v1/users/me/`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();

                    const knownRoles = [
                        "Administrador",
                        "Comercial",
                        "Producción",
                        "Satélite",
                        "Inventario",
                        "Despachos",
                        "Diseño",
                        "Operativo",
                    ];

                    const normalizeRole = (rawRole: unknown): string => {
                        if (typeof rawRole !== "string") return "";
                        const s = rawRole.trim();
                        if (!s) return "";
                        const m = s.match(/name=['"]([^'"]+)['"]/);
                        if (m?.[1]) return m[1];
                        return s;
                    };

                    const extractedRoles = (userData.roles || [])
                        .map(normalizeRole)
                        .filter(Boolean)
                        .map((r: string) => {
                            const hit = knownRoles.find(
                                (k) => k === r || r.includes(k)
                            );
                            return hit || r;
                        });

                    const extractedRole =
                        extractedRoles[0] ||
                        (knownRoles.includes(userData.roles?.[0])
                            ? userData.roles[0]
                            : "Operativo");

                    const cleanUser = {
                        id: userData.id || "",
                        username: userData.username,
                        email: userData.email,
                        first_name: userData.first_name,
                        last_name: userData.last_name,
                        roles: extractedRoles.length ? extractedRoles : [extractedRole],
                        permissions: userData.permissions || [],
                        production_stage_key: userData.production_stage_key || "",
                        production_stage_keys: Array.isArray(userData.production_stage_keys)
                            ? userData.production_stage_keys
                            : String(userData.production_stage_key || "")
                                  .split(",")
                                  .map((k: string) => k.trim())
                                  .filter(Boolean),
                        area: userData.area || "",
                        cargo: userData.cargo || "",
                        phone: userData.phone || "",
                        satellite_id: userData.satellite_id
                            ? String(userData.satellite_id)
                            : "",
                    };

                    localStorage.setItem("user", JSON.stringify(cleanUser));
                }

                toast({
                    title: "¡Sesión iniciada!",
                    description: "Has ingresado correctamente a Uniformes Activa.",
                });

                navigate("/dashboard", { replace: true });
            } else {
                throw new Error("El servidor no devolvió un token válido.");
            }

        } catch (error: any) {
            console.error("Error en autenticación:", error);
            toast({
                variant: "destructive",
                title: "Error de ingreso",
                description: error.message || "No se pudo conectar con el servidor de autenticación.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page min-h-screen w-full flex flex-col lg:flex-row">
            {/* Marca — plano visual dominante */}
            <aside className="relative hidden lg:flex lg:w-[52%] xl:w-[54%] flex-col justify-between overflow-hidden bg-black px-12 xl:px-16 py-12">
                <div className="absolute inset-0 bg-[#0a0a0a]" />
                <div className="absolute inset-0 login-diagonal" />
                <div className="absolute inset-0 login-weave opacity-80" />
                <div className="absolute -left-10 top-0 h-full w-1.5 bg-red-600 animate-login-bar" />
                <div className="absolute right-[-20%] top-[-10%] h-[420px] w-[420px] rounded-full bg-red-600/15 blur-[100px]" />
                <div className="absolute bottom-[-15%] left-[10%] h-[280px] w-[280px] rounded-full bg-red-600/10 blur-[90px]" />

                <div className="relative z-10 animate-login-rise">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600 shadow-[0_12px_40px_-12px_rgba(220,38,38,0.7)]">
                            <img
                                src="/ACTIVA_logo_blanco_16x16.webp"
                                alt=""
                                className="h-7 w-7 object-contain"
                            />
                        </div>
                        <div>
                            <p className="login-display text-2xl font-bold tracking-tight text-white leading-none">
                                Uniformes Activa
                            </p>
                            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
                                Plataforma ERP
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 max-w-xl space-y-8 animate-login-rise-delay">
                    <div className="space-y-4">
                        <h1 className="login-display max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                            Gestión integral de tu{" "}
                            <span className="text-red-500">operación textil</span>
                        </h1>
                        <p className="max-w-md text-sm leading-relaxed text-white/55 xl:text-[15px]">
                            La operación textil de tu equipo, centralizada: desde la cotización
                            hasta el despacho.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6">
                        {pillars.map((label) => (
                            <div key={label} className="flex items-center gap-2.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                <span className="text-sm font-medium text-white/80">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative z-10 text-xs tracking-wide text-white/35 animate-login-rise-delay-2">
                    © {new Date().getFullYear()} Uniformes Activa · Cerebiia
                </p>
            </aside>

            {/* Acceso */}
            <main className="relative flex min-h-screen flex-1 flex-col login-form-panel login-noise">
                <div className="flex items-center gap-3 border-b border-black/10 bg-black px-5 py-4 lg:hidden">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600">
                        <img
                            src="/ACTIVA_logo_blanco_16x16.webp"
                            alt=""
                            className="h-5 w-5 object-contain"
                        />
                    </div>
                    <div>
                        <p className="login-display text-sm font-bold text-white leading-none">
                            Uniformes Activa
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                            Plataforma ERP
                        </p>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
                    <div className="w-full max-w-[400px] animate-login-rise">
                        <div className="mb-10 space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-600">
                                Acceso
                            </p>
                            <h1 className="login-display text-2xl font-semibold tracking-tight text-neutral-950 sm:text-[1.75rem]">
                                Iniciar sesión
                            </h1>
                            <p className="text-sm leading-relaxed text-neutral-500">
                                Usa tu usuario o correo corporativo para entrar al sistema.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="username"
                                    className="text-[13px] font-semibold text-neutral-800"
                                >
                                    Usuario o correo
                                </Label>
                                <div className="relative group">
                                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition-colors group-focus-within:text-red-600" />
                                    <Input
                                        id="username"
                                        type="text"
                                        placeholder="usuario o correo@empresa.com"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="h-12 rounded-xl border-neutral-200/90 bg-white pl-11 pr-3 text-[15px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-neutral-400 focus-visible:border-red-600 focus-visible:ring-red-600/30"
                                        disabled={loading}
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="password"
                                    className="text-[13px] font-semibold text-neutral-800"
                                >
                                    Contraseña
                                </Label>
                                <div className="relative group">
                                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition-colors group-focus-within:text-red-600" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-12 rounded-xl border-neutral-200/90 bg-white pl-11 pr-11 text-[15px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-neutral-400 focus-visible:border-red-600 focus-visible:ring-red-600/30"
                                        disabled={loading}
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className={cn(
                                    "h-12 w-full rounded-xl text-[15px] font-semibold tracking-wide transition-all focus-visible:ring-red-600",
                                    isSubmitDisabled && !loading
                                        ? "bg-neutral-200 text-neutral-400 shadow-none hover:bg-neutral-200"
                                        : "bg-red-600 text-white shadow-[0_10px_28px_-12px_rgba(220,38,38,0.85)] hover:bg-red-700 hover:shadow-[0_14px_32px_-12px_rgba(220,38,38,0.9)]"
                                )}
                                disabled={isSubmitDisabled}
                                aria-disabled={isSubmitDisabled}
                            >
                                {loading ? "Autenticando..." : "Iniciar sesión"}
                            </Button>
                        </form>

                        <div className="mt-10 flex items-start gap-2.5 border-t border-neutral-200/80 pt-6 text-xs leading-relaxed text-neutral-500">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                            <span>Acceso seguro con control de permisos por rol.</span>
                        </div>

                        <p className="mt-8 text-center text-[11px] text-neutral-400 lg:hidden">
                            © {new Date().getFullYear()} Uniformes Activa · Cerebiia
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
