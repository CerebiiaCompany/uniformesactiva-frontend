export async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const token = localStorage.getItem("token");

    const headers = new Headers(init?.headers || {});
    headers.set("Content-Type", "application/json");

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.replace("/login");
        throw new Error("Unauthorized");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
            (typeof errorData.detail === "string" ? errorData.detail : null) ||
            errorData.message ||
            `Error ${response.status}: ${response.statusText}`;
        throw new Error(message);
    }
    return (await response.json()) as T;
}