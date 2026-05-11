export interface UiDesignFrame {
  id: string;
  type: string;
  name?: string;
  layout: 'vertical' | 'horizontal' | 'grid' | 'absolute';
  componentId?: string;
  children: UiDesignFrame[];
}

export interface UiDesignPage {
  id: string;
  name: string;
  route: string;
  viewport: { width: number; height: number };
  frames: UiDesignFrame[];
  states: string[];
}

export interface UiDesignComponent {
  id: string;
  name: string;
  type: string;
}

export interface UiDesignPrototypeLink {
  sourceId: string;
  targetPageId: string;
  interaction?: string;
}

export interface UiDesignArtifact {
  schemaVersion: string;
  artifact: 'ui-design';
  mode: 'wireframe' | 'hifi';
  feature: string;
  updatedAt: string;
  tokens: {
    colors: Record<string, unknown>;
    typography: Record<string, unknown>;
    spacing: Record<string, unknown>;
    radius: Record<string, unknown>;
  };
  pages: UiDesignPage[];
  components: UiDesignComponent[];
  prototype: {
    startPageId: string;
    links: UiDesignPrototypeLink[];
  };
  implementationHints: {
    preferredFramework: string;
    requiredComponents: string[];
    accessibilityNotes: string[];
  };
}

export interface UiDesignValidationResult {
  ok: boolean;
  errors: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function collectFrameIds(frames: unknown, ids: string[], errors: string[]): void {
  if (!Array.isArray(frames)) {
    errors.push('page.frames must be an array');
    return;
  }

  for (const frame of frames) {
    if (!isObject(frame)) {
      errors.push('frame id is required');
      continue;
    }

    if (typeof frame.id !== 'string' || frame.id.length === 0) errors.push('frame id is required');
    if (typeof frame.id === 'string') ids.push(frame.id);

    if (!Array.isArray(frame.children)) {
      errors.push('frame.children must be an array');
      continue;
    }
    collectFrameIds(frame.children, ids, errors);
  }
}

export function validateUiDesignArtifact(value: unknown): UiDesignValidationResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ['artifact must be an object'] };

  const artifact = value as Partial<UiDesignArtifact>;
  if (artifact.artifact !== 'ui-design') errors.push('artifact must be ui-design');
  if (artifact.mode !== 'wireframe' && artifact.mode !== 'hifi') {
    errors.push('mode must be wireframe or hifi');
  }
  if (!Array.isArray(artifact.pages) || artifact.pages.length === 0) {
    errors.push('pages must contain at least one page');
  }

  const pages = Array.isArray(artifact.pages) ? artifact.pages : [];
  const components = Array.isArray(artifact.components) ? artifact.components : [];
  const prototypeLinks = Array.isArray(artifact.prototype?.links) ? artifact.prototype.links : [];

  if (artifact.components !== undefined && !Array.isArray(artifact.components)) {
    errors.push('components must be an array');
  }
  if (artifact.prototype?.links !== undefined && !Array.isArray(artifact.prototype.links)) {
    errors.push('prototype.links must be an array');
  }

  const pageIds = new Set<string>();
  const allIds: string[] = [];
  for (const page of pages) {
    if (!isObject(page)) continue;
    if (typeof page.id === 'string') {
      pageIds.add(page.id);
      allIds.push(page.id);
    }
    collectFrameIds(page.frames, allIds, errors);
  }
  for (const component of components) {
    if (isObject(component) && typeof component.id === 'string') allIds.push(component.id);
  }

  const seen = new Set<string>();
  for (const id of allIds.filter(Boolean)) {
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
  }

  if (artifact.prototype?.startPageId && !pageIds.has(artifact.prototype.startPageId)) {
    errors.push('prototype.startPageId must reference an existing page id');
  }
  for (const [index, link] of prototypeLinks.entries()) {
    if (!isObject(link) || typeof link.targetPageId !== 'string' || !pageIds.has(link.targetPageId)) {
      errors.push(`prototype.links[${index}].targetPageId must reference an existing page id`);
    }
  }

  if (artifact.mode === 'hifi') {
    for (const section of ['colors', 'typography', 'spacing', 'radius'] as const) {
      const tokens = artifact.tokens?.[section];
      if (!tokens || !hasKeys(tokens)) errors.push(`hifi mode requires non-empty tokens.${section}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
