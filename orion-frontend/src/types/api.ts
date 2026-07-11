export interface ApplicationDto {
  id: string;
  appId: string;
  name: string;
  appName: string;
  prId?: string;
  plId?: string;
  owner?: string;
  description: string;
  baseUrl?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationSummaryDto extends ApplicationDto {
  environmentCount: number;
  testCaseCount: number;
  executionCount: number;
  hasEditAccess?: boolean;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
  description: string;
}

export interface CertificateDto {
  id: string;
  name: string;
  description: string;
  clientCert: string;
  clientCertPassword?: string;
}

export interface DatabaseConnectionDto {
  id: string;
  name: string;
  type: 'POSTGRESQL' | 'MYSQL' | 'ORACLE' | 'DB2' | 'SQLITE';
  host?: string;
  port?: number;
  databaseName: string;
  username?: string;
  password?: string;
  certificateKey?: string;
  connectionUrl?: string;
  certPlaceholder?: string;
}

export interface DatasetDto {
  id?: string;
  name: string;
  filename: string;
  csvContent: string;
}

export interface EnvironmentDto {
  id: string;
  appId: string;
  name: string;
  description: string;
  variables: EnvironmentVariable[];
  databases?: DatabaseConnectionDto[];
  certificates?: CertificateDto[];
  datasets?: DatasetDto[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sslClientCert?: string;
  sslClientCertPassword?: string;
  sslTrustAll?: boolean;
}

export interface TestCaseDto {
  id: string;
  appId: string;
  name: string;
  description: string;
  tags: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'DRAFT' | 'READY' | 'DEPRECATED';
  stepCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserAction {
  type: 'navigate' | 'fill' | 'click' | 'waitforelement' | 'screenshot';
  url?: string;
  selector?: string;
  value?: string;
  timeout?: number;
  name?: string;
}

export interface MainframeAction {
  type: 'waitForField' | 'waitForText' | 'input' | 'sendKey' | 'screenshot' | 'readField' | 'sleep';
  row?: number;
  col?: number;
  value?: string;
  key?: string;
  text?: string;
  length?: number;
  variableName?: string;
  timeout?: number;
  duration?: number;
  name?: string;
}

export interface ParallelSubStep {
  name: string;
  stepType: string;
  config: any;
}

export interface StepConfig {
  // HTTP / SOAP
  method?: string;
  url?: string;
  headers?: any;
  bodyType?: string;
  body?: any;
  timeoutMs?: number;
  clientCertKey?: string;
  retries?: number;
  retryIntervalMs?: number;
  endpointUrl?: string;
  soapVersion?: string;
  soapAction?: string;
  envelope?: string;

  // DB
  databaseKey?: string;
  connectionString?: string;
  query?: string;
  resultVariable?: string;
  tableTitle?: string;
  printAsTable?: boolean;

  // CSV Extract
  datasetSource?: 'ENVIRONMENT' | 'DESIGNER';
  datasetName?: string;
  rawCsv?: string;
  extractMode?: 'FIRST_ROW' | 'RANDOM_ROW' | 'ITERATION_ROW';
  variablePrefix?: string;

  // React Flow Coordinates
  x?: number;
  y?: number;

  // Browser
  viewportWidth?: number;
  viewportHeight?: number;
  actions?: BrowserAction[];

  // Mainframe Terminal
  mainframeHost?: string;
  mainframePort?: number;
  useSsl?: boolean;
  terminalType?: string;
  codePage?: string;
  connectTimeoutMs?: number;
  mainframeActions?: MainframeAction[];

  // Assertion & Variable
  source?: string;
  payloadFormat?: string;
  xPath?: string;
  xpath?: string;
  headerName?: string;
  variableName?: string;
  operator?: string;
  expectedValue?: string;
  failureMessage?: string;
  variableKey?: string;
  jsonPath?: string;
  variables?: any[];
  assertions?: any[];

  // Delay
  duration?: number;
  durationMs?: number;

  // Log
  level?: string;
  message?: string;

  // Script
  script?: string;

  // Conditional
  condition?: string;
  onTrueStepIndex?: number | string;
  onFalseStepIndex?: number | string;

  // Loop & Parallel
  type?: string;
  count?: number;
  iteratorVariable?: string;
  dataSource?: string;
  steps?: any[];
}

export interface TestStepDto {
  id: string;
  testCaseId: string;
  sequenceOrder: number;
  name: string;
  description: string;
  stepType: string;
  actionType: string;
  config: StepConfig;
  expectedResult: string;
  isGlobalRef: boolean;
  globalStepId: string | null;
  enabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseDetailDto extends TestCaseDto {
  steps: TestStepDto[];
}

export interface ExecutionDto {
  id: string;
  testCaseId: string;
  testCaseName: string;
  environmentId: string;
  environmentName: string;
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELLED';
  triggeredBy: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  errorMessage: string;
  createdAt: string;
}

export interface ExecutionStepLogDto {
  id: string;
  executionId: string;
  testStepId: string;
  stepName: string;
  stepType: string;
  sequenceOrder: number;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  inputPayload: any;
  outputPayload: any;
  errorMessage: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ExecutionDetailDto extends ExecutionDto {
  stepLogs: ExecutionStepLogDto[];
}

export interface ExecutionStatsDto {
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  passRate: number;
  avgDurationMs: number;
}

export interface ExecutionTrendDto {
  date: string;
  passed: number;
  failed: number;
}

export interface GlobalEnvConfigDto {
  id: string;
  configKey: string;
  configValue: string;
  description: string;
  secret: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalTestStepDto {
  id: string;
  name: string;
  description: string;
  stepType: string;
  actionType: string;
  config: StepConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface UserDto {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TESTER' | 'VIEWER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
export interface ReorderRequest {
  stepIds: string[];
}
export interface BulkSaveRequest {
  steps: {
    name: string;
    description: string;
    stepType: string;
    actionType: string;
    config: StepConfig;
    expectedResult?: string;
    isGlobalRef?: boolean;
    globalStepId?: string | null;
    enabled?: boolean;
  }[];
}
