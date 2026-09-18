import type {
  ConversationMessage,
  ConversationResolution,
  ConversationThread,
  DerivedTodo,
  ResolutionTodo,
} from '../domain/conversation-types.js';
import type { AgentStatus, PipelineStatus, StageStatus } from '../domain/state-constants.js';

type UnknownRecord = Record<string, unknown>;
type AgentLifecycleStatus = AgentStatus | 'retrying';

export interface PluginSummary {
  name: string;
  version: string;
  type: string;
  dependencies?: string[];
  manifestPath?: string;
}

export interface PluginHookResult {
  plugin: PluginSummary;
  hook: string;
  stage: number | null;
  exitCode: number;
  timestamp: string;
}

export interface AgentState {
  status: AgentLifecycleStatus;
  startTime: string | null;
  endTime: string | null;
  retryCount: number;
  maxRetries: number;
  failureReason: string | null;
  promptFingerprint?: string | null;
  inputDigest?: string | null;
}

export interface GateResult {
  passed: boolean;
  executedAt: string;
  checks: unknown[];
}

export interface StageState {
  name: string;
  status: StageStatus;
  startTime: string | null;
  endTime: string | null;
  retryCount: number;
  maxRetries: number;
  failureReason: string | null;
  artifacts: string[];
  gateResults: Record<string, GateResult>;
  agents?: Record<string, AgentState>;
}

export interface GateState {
  status: StageStatus;
  passed: boolean | null;
  checks: unknown[];
  executedAt: string | null;
}

export type WorkflowExecutionNodeStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'reused'
  | 'blocked';

export interface WorkflowExecutionNode {
  id: string;
  kind: string;
  artifact?: string;
  gate?: string;
  agent?: string | string[] | null;
  stage: number;
  phase: string;
  inputs: string[];
  /** 该节点写入的路径集合；用于并行安全组分组。缺省回退到 artifact 名。 */
  writes?: string[];
  optional: boolean;
  status: WorkflowExecutionNodeStatus;
  decision?: string;
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

export interface ExecutionMetrics {
  totalDuration: number | null;
  stageTimings: Record<string, number>;
  gatePassRate: number | null;
  retryTotal: number;
  agentSuccessCount: number;
  agentFailureCount: number;
  meanRetriesPerStage: number;
  revisionLoopCount: number;
  pluginFailureCount: number;
}

export interface PluginLifecycleState {
  discovered: PluginSummary[];
  activated: PluginSummary[];
  executed: PluginHookResult[];
  failed: PluginHookResult[];
}

export interface RevisionRequest {
  from: string;
  to: string;
  artifact: string;
  reason: string;
  priority: string;
  timestamp: string;
  resolved: boolean;
}

export interface ConversationState {
  threads: ConversationThread[];
  messages: ConversationMessage[];
  resolutions: ConversationResolution[];
}

export interface ConversationMetrics {
  opened: number;
  resolved: number;
  todos: number;
  huddles: number;
  unresolved: number;
}

export interface ExecutionState {
  schemaVersion: string;
  feature: string;
  createdAt: string;
  updatedAt: string;
  status: PipelineStatus;
  parameters: UnknownRecord;
  stages: Record<string, StageState>;
  qualityGates: Record<string, GateState>;
  metrics: ExecutionMetrics;
  plugins: PluginSummary[];
  pluginLifecycle: PluginLifecycleState;
  conversations: ConversationState;
  derivedTodos: DerivedTodo[];
  conversationMetrics: ConversationMetrics;
  humanInterventions: unknown[];
  revisionRequests: RevisionRequest[];
  feedbackLoops: { maxRounds: number; currentRound: number };
  workflow?: WorkflowExecutionState;
  pause?: {
    paused: boolean;
    reason: string;
    requestedBy: string;
    pausedAt: string;
  } | null;
}

export interface RuntimeEvent {
  id: number;
  type: string;
  timestamp: string;
  data: UnknownRecord;
}
