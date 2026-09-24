// Log diagnostic identifiers without SQL, request bodies, or database credentials.
export function isSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

export function logDatabaseError(context: string, error: unknown) {
  const detail = error as { name?: string; code?: string; meta?: Record<string, unknown> } | null;
  console.error(context, {
    name: detail?.name ?? "UnknownError",
    code: detail?.code,
    model: detail?.meta?.modelName,
    table: detail?.meta?.table,
    column: detail?.meta?.column,
    ...(isSchemaError(error) ? {
      hint: "Database schema is out of date. Run bun run db:migrate in backend using the same DATABASE_URL as this service, then restart.",
    } : {}),
  });
}
