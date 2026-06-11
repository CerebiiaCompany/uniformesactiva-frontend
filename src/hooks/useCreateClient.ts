import { useState } from "react";

export interface CreateClientData {
    nit: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
}

export function useCreateClient() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createClient = async (data: CreateClientData) => {
        setIsLoading(true);
        setError(null);

        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
        const token = localStorage.getItem("token");

        try {
            const response = await fetch(`${baseUrl}/api/v1/clients/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                let errorMessage = "Error en la validación de los datos.";

                if (result.detail) {
                    errorMessage = result.detail;
                } else if (typeof result === "object") {
                    errorMessage = Object.entries(result)
                        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
                        .join(" | ");
                }

                throw new Error(errorMessage);
            }

            setIsLoading(false);
            return { success: true, data: result };
        } catch (err: any) {
            setIsLoading(false);
            setError(err.message || "Ocurrió un error inesperado al registrar el cliente.");
            return { success: false, error: err.message };
        }
    };

    return { createClient, isLoading, error };
}