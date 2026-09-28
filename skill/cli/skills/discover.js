import * as fs from 'node:fs';
import * as path from 'node:path';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.venv', '__pycache__']);
function stripQuotes(value) {
    if (value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))) {
        return value.slice(1, -1);
    }
    return value;
}
export function parseSkillFrontmatter(content) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!match || !match[1])
        return {};
    const result = {};
    for (const line of match[1].split(/\r?\n/)) {
        const colon = line.indexOf(':');
        if (colon === -1)
            continue;
        const key = line.slice(0, colon).trim();
        const value = stripQuotes(line.slice(colon + 1).trim());
        if (key === 'name' || key === 'description' || key === 'version') {
            if (value.length > 0)
                result[key] = value;
        }
    }
    return result;
}
/** Directory-name-safe skill identifier; rejects traversal from untrusted frontmatter. */
export function sanitizeSkillName(name) {
    const cleaned = name
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, '');
    return cleaned;
}
export function readSkillAt(dir, relDir) {
    const skillMd = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillMd))
        return null;
    let content;
    try {
        content = fs.readFileSync(skillMd, 'utf8');
    }
    catch {
        return null;
    }
    const frontmatter = parseSkillFrontmatter(content);
    const rawName = frontmatter.name ?? path.basename(dir);
    const name = sanitizeSkillName(rawName);
    if (!name)
        return null;
    return {
        name,
        description: frontmatter.description ?? '',
        version: frontmatter.version,
        dir,
        relDir,
    };
}
/**
 * Recursively scan a checkout for skills. Any directory containing a SKILL.md
 * counts as one skill; once a skill directory is found we do not descend into
 * it (nested SKILL.md files belong to the enclosing skill bundle).
 */
export function discoverSkills(root) {
    const results = [];
    function walk(dir, relDir) {
        const skill = readSkillAt(dir, relDir);
        if (skill) {
            results.push(skill);
            return;
        }
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.'))
                continue;
            walk(path.join(dir, entry.name), relDir === '.' ? entry.name : `${relDir}/${entry.name}`);
        }
    }
    walk(root, '.');
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
}
