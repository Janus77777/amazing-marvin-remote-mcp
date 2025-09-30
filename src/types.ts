// MCP Protocol Types
export interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number;
  jsonrpc: "2.0";
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// OAuth Types
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthUserInfo {
  sub: string;
  amazing_marvin_api_key: string;
}

// Amazing Marvin API Types
export interface MarvinTask {
  _id: string;
  title: string;
  done: boolean;
  day?: string;
  dueDate?: string;
  priority?: string;
  timeEstimate?: number;
  parentId?: string;
  projectId?: string;
  categoryId?: string;
  labelIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface MarvinProject {
  _id: string;
  title: string;
  description?: string;
  parentId?: string;
  labelIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MarvinCategory {
  _id: string;
  title: string;
  color?: string;
  createdAt?: string;
}

export interface MarvinLabel {
  _id: string;
  title: string;
  color?: string;
  createdAt?: string;
}

export interface MarvinGoal {
  _id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed?: boolean;
  createdAt?: string;
}

export interface MarvinEvent {
  _id?: string;
  db: "Events";
  title: string;
  start: string; // ISO UTC string
  length: number; // milliseconds
  isAllDay?: boolean;
  notes?: string;
  calId?: string; // Calendar ID for sync
  createdAt: number;
  updatedAt: number;
}

export interface MarvinTimeBlock {
  _id?: string;
  db: "PlannerItems";
  title: string;
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (local)
  duration: number; // minutes
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// Clean Response Types (matching original MCP)
export interface CleanTask {
  id: string;
  title: string;
  done: boolean;
  day?: string;
  due_date?: string;
  priority?: string;
  time_estimate?: number;
  project?: Reference;
  category?: Reference;
  labels: Reference[];
}

export interface CleanProject {
  id: string;
  title: string;
  description?: string;
  parent_project?: Reference;
  labels: Reference[];
}

export interface Reference {
  id: string;
  title: string;
}

export interface ResponseMetadata {
  source: string;
  timestamp: string;
  request_id?: string;
  total_items?: number;
}

export interface ResponseSummary {
  message: string;
  item_count?: number;
  status: "success" | "partial" | "error";
}

export interface ResponseDebug {
  raw_response_size?: number;
  processing_time_ms?: number;
  cache_hit?: boolean;
}

export interface StandardResponse<T = any> {
  data: T;
  metadata: ResponseMetadata;
  summary: ResponseSummary;
  debug?: ResponseDebug;
  success: boolean;
}

// Environment Types
export interface CloudflareEnv {
  AMAZING_MARVIN_API_KEY: string;
  OAUTH_CLIENT_SECRET: string;
  JWT_SECRET: string;
  CACHE: KVNamespace;
  TOKENS: KVNamespace;
  // CouchDB 連線設定
  MARVIN_SYNC_SERVER?: string;
  MARVIN_SYNC_DATABASE?: string;
  MARVIN_SYNC_USER?: string;
  MARVIN_SYNC_PASSWORD?: string;
}

// MCP Tool Definitions
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}