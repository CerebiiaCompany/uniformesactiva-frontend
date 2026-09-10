export function normalizeReportSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesReportSearch(
  query: string,
  ...fields: Array<string | number | null | undefined>
): boolean {
  const normalized = normalizeReportSearch(query);
  if (!normalized) return true;
  return fields.some((field) =>
    String(field ?? "")
      .toLowerCase()
      .includes(normalized)
  );
}
