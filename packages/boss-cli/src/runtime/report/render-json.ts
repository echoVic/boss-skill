import type { SummaryModel } from './summary-model.js';

export function renderJson(model: SummaryModel): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}
