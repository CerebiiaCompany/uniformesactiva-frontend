import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";

export interface Variant {
    id: string;
    code: string;
    name: string;
    attributes: { color: string; talla: string; material: string };
    estimated_cost: string;
}

export interface Product {
    id: string;
    code: string;
    line_id: string;
    name: string;
    description: string;
    variants: Variant[];
}

export interface LineStructure {
    line: {
        id: string;
        code: string;
        name: string;
    };
    products: Product[];
}

export function useGetLineDetail(lineCode: string | null) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

    return useQuery({
        queryKey: ["line-structure", lineCode],
        queryFn: async () => {
            if (!lineCode) throw new Error("No se proporcionó un código de línea");
            return await http<LineStructure>(`${baseUrl}/api/v1/products/lineas/${lineCode}/estructura/`);
        },
        enabled: !!lineCode,
    });
}