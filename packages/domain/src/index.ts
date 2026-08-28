export const foundationServices = ['web', 'api', 'worker'] as const;

export type FoundationService = (typeof foundationServices)[number];

export const foundationVersion = '0.0.0';
