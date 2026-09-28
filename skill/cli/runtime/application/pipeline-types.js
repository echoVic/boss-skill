/**
 * Pipeline types — shared interfaces used across pipeline modules.
 */
export const FORMAL_SOURCE_OF_TRUTH_ARTIFACTS = Object.freeze([
    'prd.md',
    'architecture.md',
    'ui-spec.md',
    'ui-design.json',
    'tech-review.md',
    'tasks.md',
]);
export function isFormalSourceOfTruthArtifact(artifact) {
    return FORMAL_SOURCE_OF_TRUTH_ARTIFACTS.includes(artifact);
}
export { OPT_IN_OPTIONAL_ARTIFACTS } from '../domain/scheduling.js';
