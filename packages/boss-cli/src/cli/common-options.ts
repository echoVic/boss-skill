export const commonOptions = [
  { name: 'json', type: 'boolean' as const, default: false },
  { name: 'describe', type: 'boolean' as const, default: false },
  { name: 'fields', type: 'string' as const },
  { name: 'limit', type: 'string' as const, default: '100' },
  { name: 'json-input', type: 'string' as const },
  { name: 'dry-run', type: 'boolean' as const, default: false },
  { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
];

export const runtimeBaseOptions = [
  { name: 'json', type: 'boolean' as const, default: false },
  { name: 'describe', type: 'boolean' as const, default: false }
];

export const runtimeFieldOptions = [
  ...runtimeBaseOptions,
  { name: 'fields', type: 'string' as const }
];

export const runtimeListOptions = [
  ...runtimeFieldOptions,
  { name: 'limit', type: 'string' as const, default: '20' }
];

export const runtimeDryRunOptions = [
  ...runtimeFieldOptions,
  { name: 'dry-run', type: 'boolean' as const, default: false }
];

export const runtimeMutationOptions = [
  ...runtimeDryRunOptions,
  { name: 'json-input', type: 'string' as const }
];

export const runtimeHighRiskOptions = [
  ...runtimeMutationOptions,
  { name: 'yes', type: 'boolean' as const, short: 'y', default: false }
];
