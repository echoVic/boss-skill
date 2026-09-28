import * as fs from 'node:fs';
import * as path from 'node:path';
import { EVENT_TYPES } from '../domain/event-types.js';
import { appendRuntimeEvent, ensureFeatureName } from './state.js';
const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    '.boss',
    'dist',
    '.next',
    '.nuxt',
    'coverage',
]);
const TEST_EXTENSIONS = [
    '.test.ts',
    '.spec.ts',
    '.test.js',
    '.spec.js',
    '.test.tsx',
    '.spec.tsx',
    '.test.jsx',
    '.spec.jsx',
];
export function parseAcceptanceCriteria(prdContent) {
    const criteria = [];
    const lines = prdContent.split(/\r?\n/);
    let currentSection = '';
    for (const line of lines) {
        const sectionMatch = line.match(/^#{1,4}\s+.*?((?:FR|US|NFR)-\d+)/i);
        if (sectionMatch) {
            currentSection = sectionMatch[1].toUpperCase();
            continue;
        }
        const acMatch = line.match(/^[-*]\s+\[[ x]\]\s+(AC-\d+)[：:]\s*(.+)/i);
        if (acMatch) {
            criteria.push({
                id: acMatch[1].toUpperCase(),
                description: acMatch[2].trim(),
                section: currentSection,
            });
        }
    }
    return criteria;
}
function findTestFiles(dir) {
    const results = [];
    function walk(current) {
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (EXCLUDED_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            }
            else if (entry.isFile() && TEST_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
    }
    walk(dir);
    return results;
}
function scanTestFileForACs(filePath, acIds) {
    const content = fs.readFileSync(filePath, 'utf8');
    const found = new Set();
    for (const acId of acIds) {
        const escaped = acId.replace('-', '[-‐]');
        const pattern = new RegExp(escaped, 'i');
        if (pattern.test(content)) {
            found.add(acId);
        }
    }
    return found;
}
export function verifyRequirements(feature, { cwd = process.cwd(), testDir, dryRun = false, } = {}) {
    ensureFeatureName(feature);
    const prdPath = path.join(cwd, '.boss', feature, 'prd.md');
    if (!fs.existsSync(prdPath)) {
        throw new Error(`未找到 PRD 文件: .boss/${feature}/prd.md`);
    }
    const prdContent = fs.readFileSync(prdPath, 'utf8');
    const criteria = parseAcceptanceCriteria(prdContent);
    if (criteria.length === 0) {
        throw new Error(`PRD 中未找到验收标准（AC-N 格式）`);
    }
    const searchDir = testDir ? path.resolve(cwd, testDir) : cwd;
    const testFiles = findTestFiles(searchDir);
    const acIds = new Set(criteria.map((c) => c.id));
    const acToFiles = new Map();
    for (const ac of criteria) {
        acToFiles.set(ac.id, []);
    }
    for (const testFile of testFiles) {
        const found = scanTestFileForACs(testFile, acIds);
        for (const acId of found) {
            const relativePath = path.relative(cwd, testFile);
            acToFiles.get(acId).push(relativePath);
        }
    }
    const matrix = criteria.map((ac) => ({
        ac: ac.id,
        description: ac.description,
        section: ac.section,
        testFiles: acToFiles.get(ac.id) || [],
        covered: (acToFiles.get(ac.id) || []).length > 0,
    }));
    const coveredACs = matrix.filter((r) => r.covered).length;
    const totalACs = matrix.length;
    const verified = coveredACs === totalACs;
    const result = {
        feature,
        totalACs,
        coveredACs,
        uncoveredACs: totalACs - coveredACs,
        coveragePercent: totalACs > 0 ? Math.round((coveredACs / totalACs) * 1000) / 10 : 0,
        matrix,
        verified,
    };
    if (!dryRun) {
        let event;
        try {
            event = appendRuntimeEvent(cwd, feature, EVENT_TYPES.REQUIREMENTS_VERIFIED, {
                totalACs,
                coveredACs,
                uncoveredACs: totalACs - coveredACs,
                coveragePercent: result.coveragePercent,
                verified,
                uncoveredList: matrix.filter((r) => !r.covered).map((r) => r.ac),
            });
            result.event = { id: event.id, type: event.type };
        }
        catch {
            // events file may not exist in some contexts
        }
    }
    return result;
}
