import { z } from 'zod';

// ========================================
// USER TYPES
// ========================================
export interface User {
  id: string;
  email: string;
  name?: string;
  workspaceId: string;
  apiKey: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;

// ========================================
// PROVIDER TYPES
// ========================================
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama' | 'lm-studio' | 'custom';
export type ProviderFlavor = 'openai' | 'anthropic' | 'openai-compatible';

export interface ProviderConfig {
  id: string;
  userId: string;
  providerName: ProviderName;
  flavor: ProviderFlavor;
  baseUrl?: string;
  apiKeyEncrypted?: string;
  headers?: Record<string, string>;
  isDefault: boolean;
  defaultModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CreateProviderSchema = z.object({
  providerName: z.enum(['openai', 'anthropic', 'google', 'ollama', 'lm-studio', 'custom']),
  flavor: z.enum(['openai', 'anthropic', 'openai-compatible']),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  isDefault: z.boolean().default(false),
  defaultModel: z.string().optional(),
});

export type CreateProviderDto = z.infer<typeof CreateProviderSchema>;

// ========================================
// AGENT TYPES
// ========================================
export interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  mcpServers: MCPServer[];
  tools: string[];
  scheduleCron?: string;
  isActive: boolean;
  allowShell: boolean;
  maxIterations: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  mcpServers: z.array(z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  })).default([]),
  tools: z.array(z.string()).default([]),
  scheduleCron: z.string().optional(),
  isActive: z.boolean().default(true),
  allowShell: z.boolean().default(false),
  maxIterations: z.number().int().positive().default(10),
  metadata: z.record(z.any()).default({}),
});

export type CreateAgentDto = z.infer<typeof CreateAgentSchema>;

// ========================================
// EXECUTION TYPES
// ========================================
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_input';

export interface ExecutionRun {
  id: string;
  agentId: string;
  userId: string;
  status: ExecutionStatus;
  inputText?: string;
  outputResult?: Record<string, any>;
  logs: string[];
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export const ExecuteAgentSchema = z.object({
  input: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type ExecuteAgentDto = z.infer<typeof ExecuteAgentSchema>;

// ========================================
// OPENAI API TYPES
// ========================================
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string; // Format: "agent:{agent_id}"
  messages: OpenAIChatMessage[];
  stream?: boolean;
  metadata?: {
    run_async?: boolean;
    [key: string]: any;
  };
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIChatMessage;
    finish_reason: 'stop' | 'length' | 'error';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIAsyncResponse {
  id: string;
  status: ExecutionStatus;
  poll_url: string;
}

// ========================================
// RESPONSE TYPES
// ========================================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ========================================
// WORKSPACE TYPES
// ========================================
export interface WorkspaceConfig {
  userId: string;
  workspaceId: string;
  rowboatPath: string;
  configPath: string;
}

// ========================================
// JOB TYPES (BullMQ)
// ========================================
export interface AgentJobData {
  agentId: string;
  userId: string;
  runId: string;
  input?: string;
}

export interface ScheduledJobData extends AgentJobData {
  scheduleCron: string;
}
