export const redactedValue = '[REDACTED]' as const;

const sensitiveFieldName = /(authorization|cookie|credential|key|password|secret|token)/i;

export function redactSensitiveFields(
  fields: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      sensitiveFieldName.test(name) ? redactedValue : value,
    ]),
  );
}
