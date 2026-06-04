import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { EVENT_TYPES } from '../domain/event-types.js';
import type { RuntimeHashDescriptor } from './pipeline.js';
import type { ArtifactDag } from './state.js';
import {
  appendRuntimeEvent,
  ensureFeatureName,
  readExecutionView,
  readJson,
  writeJson
} from './state.js';
import { materializeState } from '../projectors/materialize-state.js';
import type { PipelinePackDefinition } from './packs.js';
import { evaluateAgentReuse } from './pipeline.js';

type UnknownRecord = Record<string, unknown>;

export type WorkflowNodeKind = 'input' | 'agent' | 'gate';
export type WorkflowResumeDecision = 'reuse' | 'run' | 'skip';
export type WorkflowNodeExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'reused'
  | 'blocked';

export interface WorkflowPlanNode {
  id: string;
  kind: WorkflowNodeKind;
  artifact?: string;
  gate?: string;
  agent?: string | string[] | null;
  stage: number;
  phase: string;
  inputs: string[];
  optional: boolean;
  parallelGroup?: string;
  description?: string;
}

export interface WorkflowPlanPhase {
  id: string;
  stage: number;
  name: string;
  nodeIds: string[];
}

export interface WorkflowPlan {
  schemaVersion: '1.0.0';
  feature: string;
  source: {
    pack: {
      name: string;
      version: string;
      hash: RuntimeHashDescriptor;
    };
    artifactDag: {
      path: string;
      version: string;
      hash: RuntimeHashDescriptor;
    };
  };
  phases: WorkflowPlanPhase[];
  nodes: WorkflowPlanNode[];
  validation: {
    deterministic: boolean;
    errors: string[];
  };
}

export interface WorkflowExecutionNode {
  id: string;
  kind: WorkflowNodeKind | 'wave';
  artifact?: string;
  gate?: string;
  agent?: string | string[] | null;
  stage: number;
  phase: string;
  inputs: string[];
  optional: boolean;
  status: WorkflowNodeExecutionStatus;
  decision?: WorkflowResumeDecision;
  reason?: string;
  updatedAt?: string;
}

export interface WorkflowExecutionState {
  planPath: string;
  hash: string;
  nodes: Record<string, WorkflowExecutionNode>;
  nextNodeIds: string[];
  resumedFromRunId?: string;
  updatedAt?: string;
}

export interface WorkflowPlanPersistence {
  plan: WorkflowPlan;
  workflowHash: RuntimeHashDescriptor;
  workflowPlanPath: string;
  packHash: RuntimeHashDescriptor;
  artifactDagHash: RuntimeHashDescriptor;
}

export interface ResumeWorkflowNodeDecision {
  id: string;
  kind: WorkflowNodeKind;
  artifact?: string;
  gate?: string;
  agent?: string;
  stage: number;
  decision: WorkflowResumeDecision;
  reason: string;
}

export interface ResumeWorkflowResult {
  feature: string;
  fromRunId: string;
  runId: string;
  workflowPlanPath: string;
  workflowHash: string;
  nodes: ResumeWorkflowNodeDecision[];
  nextNodeIds: string[];
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const object = value as UnknownRecord;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(',')}}`;
}

export function hashWorkflowValue(value: unknown): RuntimeHashDescriptor {
  return {
    algorithm: 'sha256',
    value: sha256Hex(stableStringify(value))
  };
}

function phaseName(stage: number): string {
  switch (stage) {
    case 0:
      return 'intake';
    case 1:
      return 'planning';
    case 2:
      return 'review';
    case 3:
      return 'development';
    case 4:
      return 'deployment';
    default:
      return `stage-${stage}`;
  }
}

function normalizeStage(value: unknown): number {
  const stage = Number(value ?? 0);
  if (!Number.isInteger(stage) || stage < 0) {
    throw new Error(`workflow plan stage must be a non-negative integer: ${JSON.stringify(value)}`);
  }
  return stage;
}

function normalizeInputs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function includesDynamicScript(script: string): string | null {
  const banned = [
    'Date.now',
    'new Date',
    'Math.random',
    '$(',
    '`'
  ];
  return banned.find((pattern) => script.includes(pattern)) ?? null;
}

function validateArtifactDag(artifactDag: ArtifactDag): void {
  const artifacts = artifactDag.artifacts || {};
  const names = new Set(Object.keys(artifacts));
  const errors: string[] = [];

  for (const [artifact, definition] of Object.entries(artifacts)) {
    const inputs = normalizeInputs(definition.inputs);
    for (const input of inputs) {
      if (!names.has(input)) {
        errors.push(`artifact ${artifact} references undeclared input ${input}`);
      }
    }

    if (typeof definition.script === 'string') {
      const dynamicPattern = includesDynamicScript(definition.script);
      if (dynamicPattern) {
        errors.push(`artifact ${artifact} uses non-deterministic script pattern ${dynamicPattern}`);
      }
    }

    if (
      definition.type !== 'gate' &&
      definition.agent == null &&
      normalizeStage(definition.stage) > 0
    ) {
      errors.push(`artifact ${artifact} has no agent or gate binding`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid workflow plan: ${errors.join('; ')}`);
  }
}

function toWorkflowNode(artifact: string, definition: NonNullable<ArtifactDag['artifacts']>[string]): WorkflowPlanNode {
  const stage = normalizeStage(definition.stage);
  const isGate = definition.type === 'gate' || artifact.startsWith('gate');
  const hasAgent = definition.agent != null;
  const phase = `stage-${stage}`;
  const node: WorkflowPlanNode = {
    id: isGate ? `gate:${artifact}` : `artifact:${artifact}`,
    kind: isGate ? 'gate' : hasAgent ? 'agent' : 'input',
    artifact,
    stage,
    phase,
    inputs: normalizeInputs(definition.inputs),
    optional: definition.optional === true,
    description: definition.description
  };

  if (isGate) {
    node.gate = artifact;
  } else {
    node.agent = definition.agent ?? null;
  }

  if (Array.isArray(definition.agent) && definition.agent.length > 1) {
    node.parallelGroup = `stage-${stage}-${artifact}`;
  }

  return node;
}

function sortNodes(left: WorkflowPlanNode, right: WorkflowPlanNode): number {
  if (left.stage !== right.stage) return left.stage - right.stage;
  return left.id.localeCompare(right.id);
}

export function compileWorkflowPlan({
  feature,
  pack,
  artifactDag,
  artifactDagFingerprint
}: {
  feature: string;
  pack: PipelinePackDefinition;
  artifactDag: ArtifactDag;
  artifactDagFingerprint: { path: string; version: string; hash: RuntimeHashDescriptor };
}): WorkflowPlan {
  ensureFeatureName(feature);
  validateArtifactDag(artifactDag);

  const nodes = Object.entries(artifactDag.artifacts || {})
    .map(([artifact, definition]) => toWorkflowNode(artifact, definition))
    .sort(sortNodes);

  const phases = [...new Set(nodes.map((node) => node.stage))]
    .sort((left, right) => left - right)
    .map((stage) => ({
      id: `stage-${stage}`,
      stage,
      name: phaseName(stage),
      nodeIds: nodes.filter((node) => node.stage === stage).map((node) => node.id)
    }));

  return {
    schemaVersion: '1.0.0',
    feature,
    source: {
      pack: {
        name: pack.name,
        version: pack.version,
        hash: hashWorkflowValue({
          name: pack.name,
          version: pack.version,
          type: pack.type,
          priority: pack.priority,
          config: pack.config
        })
      },
      artifactDag: artifactDagFingerprint
    },
    phases,
    nodes,
    validation: {
      deterministic: true,
      errors: []
    }
  };
}

export function persistWorkflowPlan({
  cwd,
  feature,
  plan
}: {
  cwd: string;
  feature: string;
  plan: WorkflowPlan;
}): WorkflowPlanPersistence {
  const relativePlanPath = `.boss/${feature}/.meta/workflow-plan.json`;
  const absolutePlanPath = path.join(cwd, relativePlanPath);
  const workflowHash = hashWorkflowValue(plan);
  writeJson(absolutePlanPath, plan);
  return {
    plan,
    workflowHash,
    workflowPlanPath: relativePlanPath,
    packHash: plan.source.pack.hash,
    artifactDagHash: plan.source.artifactDag.hash
  };
}

function isSatisfiedStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'reused' || status === 'skipped';
}

function findNodeIdByArtifact(nodes: Record<string, WorkflowExecutionNode>, artifact: string): string | null {
  for (const node of Object.values(nodes)) {
    if (node.artifact === artifact) return node.id;
  }
  return null;
}

function nodeInputsSatisfied(node: WorkflowExecutionNode, nodes: Record<string, WorkflowExecutionNode>): boolean {
  for (const input of node.inputs) {
    const inputNodeId = findNodeIdByArtifact(nodes, input);
    if (!inputNodeId) continue;
    if (!isSatisfiedStatus(nodes[inputNodeId]?.status)) return false;
  }
  return true;
}

export function refreshWorkflowSchedule(workflow: WorkflowExecutionState): WorkflowExecutionState {
  const nodes = { ...workflow.nodes };
  for (const [id, node] of Object.entries(nodes)) {
    if (node.kind === 'input') {
      nodes[id] = { ...node, status: 'skipped', decision: node.decision ?? 'skip' };
      continue;
    }
    if (isSatisfiedStatus(node.status) || node.status === 'running' || node.status === 'failed') {
      continue;
    }
    nodes[id] = {
      ...node,
      status: nodeInputsSatisfied(node, nodes) ? 'ready' : 'blocked'
    };
  }

  const ready = Object.values(nodes)
    .filter((node) => node.status === 'ready')
    .sort((left, right) => {
      if (left.stage !== right.stage) return left.stage - right.stage;
      return left.id.localeCompare(right.id);
    });
  const nextStage = ready[0]?.stage;
  const nextNodeIds = nextStage === undefined
    ? []
    : ready.filter((node) => node.stage === nextStage).map((node) => node.id);

  return {
    ...workflow,
    nodes,
    nextNodeIds
  };
}

export function createWorkflowExecutionState({
  plan,
  workflowPlanPath,
  workflowHash
}: {
  plan: WorkflowPlan;
  workflowPlanPath: string;
  workflowHash: RuntimeHashDescriptor;
}): WorkflowExecutionState {
  const nodes = Object.fromEntries(
    plan.nodes.map((node) => [
      node.id,
      {
        ...node,
        status: node.kind === 'input' ? 'skipped' : 'pending',
        decision: node.kind === 'input' ? 'skip' : undefined,
        reason: node.kind === 'input' ? 'input-node' : undefined
      } satisfies WorkflowExecutionNode
    ])
  );
  return refreshWorkflowSchedule({
    planPath: workflowPlanPath,
    hash: workflowHash.value,
    nodes,
    nextNodeIds: []
  });
}

function readWorkflowPlan(cwd: string, workflowPlanPath: string): WorkflowPlan {
  const absolutePath = path.isAbsolute(workflowPlanPath)
    ? workflowPlanPath
    : path.join(cwd, workflowPlanPath);
  return readJson<WorkflowPlan>(absolutePath);
}

function firstAgent(agent: string | string[] | null | undefined): string {
  return Array.isArray(agent) ? agent[0] ?? '' : agent ?? '';
}

function nodePrompt(node: WorkflowPlanNode): string {
  return `${firstAgent(node.agent)}:${node.artifact ?? node.id}`;
}

function resumeDecisionForNode(
  feature: string,
  node: WorkflowPlanNode,
  cwd: string
): ResumeWorkflowNodeDecision {
  if (node.kind === 'input') {
    return {
      id: node.id,
      kind: node.kind,
      artifact: node.artifact,
      stage: node.stage,
      decision: 'skip',
      reason: 'input-node'
    };
  }

  if (node.kind === 'gate') {
    return {
      id: node.id,
      kind: node.kind,
      artifact: node.artifact,
      gate: node.gate,
      stage: node.stage,
      decision: 'run',
      reason: 'gate-evaluation-required'
    };
  }

  const agent = firstAgent(node.agent);
  if (!agent) {
    return {
      id: node.id,
      kind: node.kind,
      artifact: node.artifact,
      stage: node.stage,
      decision: 'run',
      reason: 'agent-missing'
    };
  }

  const reuse = evaluateAgentReuse(feature, node.stage, agent, {
    cwd,
    prompt: nodePrompt(node),
    dependencyArtifacts: node.inputs
  });
  return {
    id: node.id,
    kind: node.kind,
    artifact: node.artifact,
    agent,
    stage: node.stage,
    decision: reuse.reusable ? 'reuse' : 'run',
    reason: reuse.reason
  };
}

export function resumeWorkflow(
  feature: string,
  {
    cwd = process.cwd(),
    fromRunId
  }: {
    cwd?: string;
    fromRunId: string;
  }
): ResumeWorkflowResult {
  ensureFeatureName(feature);
  if (!fromRunId) throw new Error('缺少 fromRunId 参数');
  const execution = readExecutionView(cwd, feature);
  const runId = typeof execution.parameters?.runId === 'string' ? execution.parameters.runId : '';
  if (fromRunId !== runId) {
    throw new Error(`fromRunId does not match active runId: ${fromRunId}`);
  }

  const workflowPlanPath =
    typeof execution.parameters?.workflowPlanPath === 'string'
      ? execution.parameters.workflowPlanPath
      : `.boss/${feature}/.meta/workflow-plan.json`;
  const workflowHash =
    typeof execution.parameters?.workflowHash === 'string'
      ? execution.parameters.workflowHash
      : '';
  const plan = readWorkflowPlan(cwd, workflowPlanPath);
  const nodes = plan.nodes.map((node) => resumeDecisionForNode(feature, node, cwd));
  const projectedWorkflow = refreshWorkflowSchedule({
    planPath: workflowPlanPath,
    hash: workflowHash,
    nodes: Object.fromEntries(
      plan.nodes.map((node) => [
        node.id,
        {
          ...node,
          status:
            nodes.find((decision) => decision.id === node.id)?.decision === 'reuse'
              ? 'reused'
              : nodes.find((decision) => decision.id === node.id)?.decision === 'skip'
                ? 'skipped'
                : 'pending',
          decision: nodes.find((decision) => decision.id === node.id)?.decision,
          reason: nodes.find((decision) => decision.id === node.id)?.reason
        } satisfies WorkflowExecutionNode
      ])
    ),
    nextNodeIds: []
  });

  appendRuntimeEvent(cwd, feature, EVENT_TYPES.PIPELINE_RESUMED, {
    fromRunId,
    runId,
    workflowPlanPath,
    workflowHash,
    reusedNodes: nodes.filter((node) => node.decision === 'reuse').length,
    runnableNodes: nodes.filter((node) => node.decision === 'run').length,
    nextNodeIds: projectedWorkflow.nextNodeIds,
    nodes
  });
  materializeState(feature, cwd);

  return {
    feature,
    fromRunId,
    runId,
    workflowPlanPath,
    workflowHash,
    nodes,
    nextNodeIds: projectedWorkflow.nextNodeIds
  };
}
