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
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
  description: string;
}

export interface EnvironmentDto {
  id: string;
  appId: string;
  name: string;
  description: string;
  variables: EnvironmentVariable[];
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

export interface TestStepDto {
  id: string;
  testCaseId: string;
  sequenceOrder: number;
  name: string;
  description: string;
  stepType: string;
  actionType: string;
  config: any;
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
  config: any;
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
    config: any;
    expectedResult?: string;
    isGlobalRef?: boolean;
    globalStepId?: string | null;
    enabled?: boolean;
  }[];
}
