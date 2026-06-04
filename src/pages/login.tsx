import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            navigate("/dashboard", { replace: true });
        }
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            toast({
                variant: "destructive",
                title: "Campos vacíos",
                description: "Por favor, ingresa tu usuario y contraseña.",
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("http://127.0.0.1:8000/api/v1/auth/token/", {
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

                const userResponse = await fetch("http://127.0.0.1:8000/api/v1/users/me/", {
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
                    title: "¡Sesión Iniciada!",
                    description: "Has ingresado correctamente a FlowTextil.",
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
        <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 px-4">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

            <Card className="w-full max-w-md relative z-10 shadow-xl border-border bg-card animate-fade-in">
                <CardHeader className="space-y-2 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="p-3 bg-primary/10 rounded-full text-primary">
                            <Lock className="h-6 w-6" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                        FlowTextil
                    </CardTitle>
                    <CardDescription>
                        Ingresa tus credenciales organizacionales para acceder al ERP.
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Nombre de Usuario o Correo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="admin_flow"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-10"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-3">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Autenticando..." : "Iniciar Sesión"}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            Control de accesos
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}