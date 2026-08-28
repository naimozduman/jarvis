export const redactedValue = '[REDACTED]' as const;

export const sensitiveFieldCategories = [
  'secret',
  'authentication',
  'message_content',
  'financial',
  'health',
  'relationship',
  'legal',
  'location',
  'provider_metadata',
] as const;

export type SensitiveFieldCategory = (typeof sensitiveFieldCategories)[number];

const sensitiveFieldMatchers: readonly [RegExp, SensitiveFieldCategory][] = [
  [
    /(authorization|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key)/i,
    'secret',
  ],
  [/(session|passkey|bearer|digest|nonce|signature)/i, 'authentication'],
  [/(message|body|content|transcript|caption|attachment|raw[-_]?payload)/i, 'message_content'],
  [/(bank|account|balance|transaction|card|payment|finance|plaid)/i, 'financial'],
  [/(health|workout|sleep|recovery|medical|whoop)/i, 'health'],
  [/(relationship|contact|person|family)/i, 'relationship'],
  [/(legal|contract|case)/i, 'legal'],
  [/(location|address|latitude|longitude|coordinate)/i, 'location'],
  [/(provider|webhook|headers?)/i, 'provider_metadata'],
];

export function classifySensitiveField(name: string): SensitiveFieldCategory | undefined {
  return sensitiveFieldMatchers.find(([matcher]) => matcher.test(name))?.[1];
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      return redactedValue;
    }

    seen.add(value);
    const redacted = Object.fromEntries(
      Object.entries(value).map(([name, nestedValue]) => [
        name,
        classifySensitiveField(name) ? redactedValue : redactValue(nestedValue, seen),
      ]),
    );
    seen.delete(value);
    return redacted;
  }

  return value;
}

/** Redacts recursively so raw event, credential, and personal fields cannot leak to logs or audit. */
export function redactSensitiveMetadata(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

export function redactSensitiveFields(
  fields: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return redactSensitiveMetadata(fields) as Record<string, unknown>;
}
