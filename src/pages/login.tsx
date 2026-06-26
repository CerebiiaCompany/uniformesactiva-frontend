import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    BarChart3,
    Factory,
    Lock,
    ShieldCheck,
    ShoppingCart,
    User,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const highlights = [
    {
        icon: ShoppingCart,
        title: "Comercial",
        description: "Clientes, cotizaciones y órdenes en un solo lugar.",
    },
    {
        icon: Factory,
        title: "Operación",
        description: "Producción, inventario y costos bajo control.",
    },
    {
        icon: BarChart3,
        title: "Gerencia",
        description: "Reportes y métricas para decisiones oportunas.",
    },
];

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const isFormValid = username.trim().length > 0 && password.trim().length > 0;
    const isSubmitDisabled = loading || !isFormValid;

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            navigate("/dashboard", { replace: true });
        }
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Usuario o contraseña incorrectos.");
            }

            const token = data.access || data.token;

            if (token) {
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

                    const rawRoleString = userData.roles?.[0] || "";
                    let extractedRole = "Operativo";

                    if (rawRoleString.includes("name='Administrador'") || rawRoleString === "Administrador") {
                        extractedRole = "Administrador";
                    } else if (rawRoleString.includes("name='Comercial'") || rawRoleString === "Comercial") {
                        extractedRole = "Comercial";
                    } else if (rawRoleString.includes("name='Operativo'") || rawRoleString === "Operativo") {
                        extractedRole = "Operativo";
                    }

                    const cleanUser = {
                        username: userData.username,
                        email: userData.email,
                        first_name: userData.first_name,
                        last_name: userData.last_name,
                        roles: [extractedRole],
                        permissions: userData.permissions || []
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
        <div className="min-h-screen w-full flex flex-col lg:flex-row">
            {/* Panel de marca — negro, blanco y rojo */}
            <div className="relative hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between overflow-hidden bg-black p-10 xl:p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-neutral-900" />
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />
                <div className="absolute left-0 top-0 h-full w-1 bg-red-600" />

                <div className="relative z-10 animate-slide-in">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/30">
                            <img
                                src="/ACTIVA_logo_blanco_16x16.webp"
                                alt="Uniformes Activa"
                                className="h-6 w-6 object-contain"
                            />
                        </div>
                        <div>
                            <p className="text-lg font-bold tracking-tight text-white">
                                Uniformes Activa
                            </p>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                                Plataforma ERP
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 space-y-8 animate-fade-in">
                    <div className="space-y-3">
                        <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
                            Gestión integral de tu operación textil
                        </h1>
                        <p className="max-w-md text-sm leading-relaxed text-white/60">
                            Centraliza clientes, producción, inventario y reportes en una sola plataforma
                            diseñada para equipos comerciales y operativos.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {highlights.map((item) => (
                            <div
                                key={item.title}
                                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-white/60">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative z-10 text-xs text-white/40">
                    © {new Date().getFullYear()} Uniformes Activa · Cerebiia
                </p>
            </div>

            {/* Panel de acceso — blanco y negro con acentos rojos */}
            <div className="flex min-h-screen flex-1 flex-col bg-white">
                <div className="flex items-center gap-3 border-b border-neutral-200 bg-black px-6 py-4 lg:hidden">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600">
                        <img
                            src="/ACTIVA_logo_blanco_16x16.webp"
                            alt="Uniformes Activa"
                            className="h-5 w-5 object-contain"
                        />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">Uniformes Activa</p>
                        <p className="text-[10px] text-white/60">Plataforma ERP</p>
                    </div>
                </div>

                <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
                    <div className="w-full max-w-md animate-fade-in">
                        <div className="mb-8 space-y-2 text-center lg:text-left">
                            <h2 className="text-2xl font-bold tracking-tight text-black">
                                Iniciar sesión
                            </h2>
                            <p className="text-sm text-neutral-500">
                                Ingresa tus credenciales organizacionales para acceder al sistema.
                            </p>
                        </div>

                        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="text-sm font-medium text-black">
                                        Usuario o correo
                                    </Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                                        <Input
                                            id="username"
                                            type="text"
                                            placeholder="tu.usuario"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="h-11 rounded-lg border-neutral-300 bg-white pl-10 text-black placeholder:text-neutral-400 focus-visible:ring-red-600"
                                            disabled={loading}
                                            autoComplete="username"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-sm font-medium text-black">
                                        Contraseña
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-11 rounded-lg border-neutral-300 bg-white pl-10 text-black placeholder:text-neutral-400 focus-visible:ring-red-600"
                                            disabled={loading}
                                            autoComplete="current-password"
                                            required
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="h-11 w-full rounded-lg text-sm font-semibold shadow-sm transition-colors focus-visible:ring-red-600 disabled:pointer-events-none disabled:opacity-100 bg-red-600 text-white hover:bg-red-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
                                    disabled={isSubmitDisabled}
                                    aria-disabled={isSubmitDisabled}
                                >
                                    {loading ? "Autenticando..." : "Iniciar sesión"}
                                </Button>
                            </form>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500 lg:justify-start">
                            <ShieldCheck className="h-3.5 w-3.5 text-red-600" />
                            <span>Acceso seguro con control de permisos por rol</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
