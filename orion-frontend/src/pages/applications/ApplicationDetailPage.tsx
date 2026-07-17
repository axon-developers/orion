import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Textarea, Badge, Tabs, TabsList, TabsTrigger, TabsContent,
  Dialog, DialogHeader, DialogTitle, DialogFooter, Switch, Select
} from '../../components/ui';
import { 
  Boxes, Sliders, Play, Trash2, Edit2, Copy, Plus, Loader2, Star,
  ArrowLeft, Globe, Eye, EyeOff, Key, Code, HelpCircle, Activity,
  Download, FileJson, CheckCircle, XCircle, AlertCircle, X, ArrowRight, Shield
} from 'lucide-react';
import { 
  ApplicationSummaryDto, EnvironmentDto, TestCaseDto, ExecutionDto,
  EnvironmentVariable, PagedResponse, DatabaseConnectionDto, DatasetDto
} from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { RunTestDialog } from '../../components/shared/RunTestDialog';
import { CollaboratorsTab } from '../../components/applications/CollaboratorsTab';
import { TestSuiteTab } from '../../components/applications/TestSuiteTab';
import { EnvVariableDiff } from '../../components/applications/EnvVariableDiff';
import { toast } from 'sonner';

export const ApplicationDetailPage: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('overview');

  // Dialog control states
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isEnvDrawerOpen, setIsEnvDrawerOpen] = useState(false);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<{ id: string; name: string } | null>(null);

  const [importType, setImportType] = useState<'openapi' | 'yaml'>('yaml');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Form states
  const [envName, setEnvName] = useState('');
  const [envDesc, setEnvDesc] = useState('');
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [databases, setDatabases] = useState<DatabaseConnectionDto[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<DatasetDto[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentDto | null>(null);
  const [sslClientCert, setSslClientCert] = useState('');
  const [sslClientCertPassword, setSslClientCertPassword] = useState('');
  const [sslTrustAll, setSslTrustAll] = useState(false);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'variables' | 'databases' | 'certificates' | 'datasets'>('variables');

  const [tcName, setTcName] = useState('');
  const [tcDesc, setTcDesc] = useState('');
  const [tcPriority, setTcPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [tcTags, setTcTags] = useState<string[]>([]);
  const [tcTagInput, setTcTagInput] = useState('');

  // ── API Queries ───────────────────────────────────────────────────────────
  // Fetch app summary details
  const { data: appSummary, isLoading: isAppLoading } = useQuery<ApplicationSummaryDto>({
    queryKey: ['application-summary', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/summary`);
      return res.data;
    },
    enabled: !!appId,
  });

  // Fetch environments list
  const { data: environments, isLoading: isEnvsLoading } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: !!appId && activeTab === 'environments',
  });

  // Fetch test cases
  const { data: testCases, isLoading: isTestCasesLoading } = useQuery<PagedResponse<TestCaseDto>>({
    queryKey: ['testcases', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/testcases?page=0&size=100`);
      return res.data;
    },
    enabled: !!appId && activeTab === 'testcases',
  });

  // Fetch executions
  const { data: executions, isLoading: isExecsLoading } = useQuery<PagedResponse<ExecutionDto>>({
    queryKey: ['executions', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/executions?page=0&size=50`);
      return res.data;
    },
    enabled: !!appId && activeTab === 'executions',
  });

  // ── API Mutations ────────────────────────────────────────────────────────
  // Environment mutations
  const saveEnvMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: envName,
        description: envDesc,
        variables,
        databases,
        certificates,
        datasets,
        sslClientCert,
        sslClientCertPassword,
        sslTrustAll,
      };
      if (selectedEnv) {
        await api.put(`/applications/${appId}/environments/${selectedEnv.id}`, payload);
      } else {
        await api.post(`/applications/${appId}/environments`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      setIsEnvModalOpen(false);
      setIsEnvDrawerOpen(false);
      resetEnvForm();
      toast.success(selectedEnv ? 'Environment updated' : 'Environment created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save environment');
    },
  });

  const cloneEnvMutation = useMutation({
    mutationFn: async (envId: string) => {
      await api.post(`/applications/${appId}/environments/${envId}/clone`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      toast.success('Environment cloned successfully');
    },
  });

  const deleteEnvMutation = useMutation({
    mutationFn: async (envId: string) => {
      await api.delete(`/applications/${appId}/environments/${envId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      toast.success('Environment deleted');
    },
  });

  const setDefaultEnvMutation = useMutation({
    mutationFn: async (envId: string) => {
      await api.put(`/applications/${appId}/environments/${envId}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments', appId] });
      toast.success('Default environment updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update default environment');
    },
  });

  // Test case mutations
  const saveTestCaseMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/applications/${appId}/testcases`, {
        name: tcName,
        description: tcDesc,
        priority: tcPriority,
        tags: tcTags,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['testcases', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      setIsTestCaseModalOpen(false);
      resetTestCaseForm();
      toast.success('Test Case created');
      // Direct user to the visual workflow builder designer!
      navigate(`/applications/${appId}/testcases/${data.id}/designer`);
    },
  });

  const importTestCaseMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) return;
      const formData = new FormData();
      formData.append('name', importName);
      formData.append('file', importFile);
      const res = await api.post(`/applications/${appId}/testcases/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['testcases', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      setIsImportModalOpen(false);
      setImportName('');
      setImportFile(null);
      setValidationResult(null);
      toast.success('Test Case imported successfully');
      navigate(`/applications/${appId}/testcases/${data.id}/designer`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to import OpenAPI spec');
    },
  });

  const importYamlTestCaseMutation = useMutation({
    mutationFn: async () => {
      if (!importFile) return;
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post(`/applications/${appId}/testcases/import-yaml`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['testcases', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      setIsImportModalOpen(false);
      setImportFile(null);
      setValidationResult(null);
      toast.success('YAML Test Case imported successfully');
      navigate(`/applications/${appId}/testcases/${data.id}/designer`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to import YAML test case');
    },
  });

  const handleValidateYaml = async (file: File) => {
    setIsValidating(true);
    setValidationResult(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/applications/${appId}/testcases/validate-yaml-import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setValidationResult(res.data);
      if (res.data.errors && res.data.errors.length > 0) {
        setValidationErrors(res.data.errors);
      }
      if (res.data.warnings && res.data.warnings.length > 0) {
        setValidationWarnings(res.data.warnings);
      }
    } catch (err: any) {
      setValidationErrors([err.response?.data?.message || err.message || 'Validation failed']);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExportTestCase = async (tcId: string, name: string) => {
    try {
      const res = await api.get(`/applications/${appId}/testcases/${tcId}/export`, {
        params: { format: 'yaml' },
        responseType: 'text',
      });
      const blob = new Blob([res.data], { type: 'application/x-yaml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${name.toLowerCase().replace(/\s+/g, '_')}_testcase.yaml`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('YAML exported successfully');
    } catch (err: any) {
      toast.error('Failed to export YAML: ' + (err.response?.data?.message || err.message));
    }
  };

  const deleteTestCaseMutation = useMutation({
    mutationFn: async (tcId: string) => {
      await api.delete(`/applications/${appId}/testcases/${tcId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testcases', appId] });
      queryClient.invalidateQueries({ queryKey: ['application-summary', appId] });
      toast.success('Test Case deleted');
    },
  });

  const cloneTestCaseMutation = useMutation({
    mutationFn: async (tcId: string) => {
      await api.post(`/applications/${appId}/testcases/${tcId}/clone`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testcases', appId] });
      toast.success('Test Case cloned');
    },
  });

  // ── Form handlers ────────────────────────────────────────────────────────
  const resetEnvForm = () => {
    setEnvName('');
    setEnvDesc('');
    setVariables([]);
    setDatabases([]);
    setCertificates([]);
    setDatasets([]);
    setSelectedEnv(null);
    setSslClientCert('');
    setSslClientCertPassword('');
    setSslTrustAll(false);
    setDrawerActiveTab('variables');
  };

  const handleOpenEnvCreate = () => {
    resetEnvForm();
    setIsEnvModalOpen(true);
  };

  const handleOpenEnvEdit = (env: EnvironmentDto) => {
    setSelectedEnv(env);
    setEnvName(env.name);
    setEnvDesc(env.description || '');
    setVariables(env.variables.map(v => ({
      key: v.key,
      value: v.value || '',
      isSecret: v.isSecret,
      description: v.description || ''
    })));
    setDatabases(env.databases || []);
    setCertificates(env.certificates || []);
    setDatasets(env.datasets || []);
    setSslClientCert(env.sslClientCert || '');
    setSslClientCertPassword(env.sslClientCertPassword || '');
    setSslTrustAll(env.sslTrustAll || false);
    setIsEnvModalOpen(true);
  };

  const handleOpenEnvDrawer = (env: EnvironmentDto) => {
    setSelectedEnv(env);
    setEnvName(env.name);
    setEnvDesc(env.description || '');
    setVariables(env.variables.map(v => ({
      key: v.key,
      value: v.value || '',
      isSecret: v.isSecret,
      description: v.description || ''
    })));
    setDatabases(env.databases || []);
    setCertificates(env.certificates || []);
    setDatasets(env.datasets || []);
    setSslClientCert(env.sslClientCert || '');
    setSslClientCertPassword(env.sslClientCertPassword || '');
    setSslTrustAll(env.sslTrustAll || false);
    setIsEnvDrawerOpen(true);
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const base64Str = result.split(',')[1] || result;
        setSslClientCert(base64Str);
        toast.success(`Loaded client certificate: ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read certificate file.");
    };
    reader.readAsDataURL(file);
  };

  const addCertificateRow = () => {
    setCertificates([...certificates, { id: `cert_${Date.now()}`, name: '', description: '', clientCert: '', clientCertPassword: '' }]);
  };

  const removeCertificateRow = (idx: number) => {
    const next = [...certificates];
    next.splice(idx, 1);
    setCertificates(next);
  };

  const updateCertificate = (idx: number, key: string, val: any) => {
    const next = [...certificates];
    next[idx] = { ...next[idx], [key]: val };
    setCertificates(next);
  };

  const handleNamedCertUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      updateCertificate(idx, 'clientCert', base64);
      toast.success(`Loaded certificate file: ${file.name}`);
    };
    reader.onerror = () => {
      toast.error("Failed to load certificate file.");
    };
    reader.readAsDataURL(file);
  };

  const addDatasetRow = () => {
    setDatasets([...datasets, { id: `dataset_${Date.now()}`, name: '', filename: '', csvContent: '' }]);
  };

  const removeDatasetRow = (idx: number) => {
    const next = [...datasets];
    next.splice(idx, 1);
    setDatasets(next);
  };

  const updateDataset = (idx: number, key: string, val: any) => {
    const next = [...datasets];
    next[idx] = { ...next[idx], [key]: val };
    setDatasets(next);
  };

  const handleDatasetCsvUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const next = [...datasets];
        next[idx] = { 
          ...next[idx], 
          filename: file.name, 
          name: next[idx].name || baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
          csvContent: result 
        };
        setDatasets(next);
        toast.success(`Loaded dataset file: ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read dataset CSV file.");
    };
    reader.readAsText(file);
  };

  const validateVariablesClient = (): boolean => {
    const keys = new Set<string>();
    for (const v of variables) {
      const key = v.key.trim();
      const val = v.value.trim();
      if (!key) {
        toast.error("Variable key cannot be empty");
        return false;
      }
      if (!val) {
        toast.error(`Value for key "${key}" cannot be empty`);
        return false;
      }
      if (!/^[A-Za-z0-9_]+$/.test(key)) {
        toast.error(`Variable key "${key}" contains invalid characters. Only alphanumeric and underscores (_) are allowed.`);
        return false;
      }
      if (keys.has(key)) {
        toast.error(`Duplicate variable key "${key}"`);
        return false;
      }
      keys.add(key);
    }
    return true;
  };

  const handleSaveEnvVariables = () => {
    if (!validateVariablesClient()) return;
    saveEnvMutation.mutate();
  };

  const addVariableRow = () => {
    setVariables([...variables, { key: '', value: '', isSecret: false, description: '' }]);
  };

  const removeVariableRow = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof EnvironmentVariable, val: any) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: val };
    setVariables(updated);
  };

  const addDatabaseRow = () => {
    setDatabases([...databases, { 
      id: `db_${Date.now()}`, 
      name: '', 
      type: 'POSTGRESQL', 
      host: '', 
      port: 5432, 
      databaseName: '', 
      username: '', 
      password: '',
      connectionUrl: '',
      certPlaceholder: '{{CERT_PATH}}'
    }]);
  };

  const removeDatabaseRow = (index: number) => {
    setDatabases(databases.filter((_, i) => i !== index));
  };

  const updateDatabase = (index: number, field: keyof DatabaseConnectionDto, val: any) => {
    const updated = [...databases];
    updated[index] = { ...updated[index], [field]: val };
    setDatabases(updated);
  };

  const handleParseUrl = (idx: number, url: string) => {
    try {
      const trimmedUrl = url.trim();
      let normalizedUrl = trimmedUrl;
      if (!normalizedUrl.startsWith('jdbc:')) {
        if (normalizedUrl.startsWith('postgres://')) {
          normalizedUrl = 'jdbc:postgresql://' + normalizedUrl.substring(11);
        } else if (normalizedUrl.startsWith('postgresql://')) {
          normalizedUrl = 'jdbc:postgresql://' + normalizedUrl.substring(13);
        } else if (normalizedUrl.startsWith('mysql://')) {
          normalizedUrl = 'jdbc:mysql://' + normalizedUrl.substring(8);
        } else if (normalizedUrl.startsWith('oracle://')) {
          normalizedUrl = 'jdbc:oracle:thin:@//' + normalizedUrl.substring(9);
        } else if (normalizedUrl.startsWith('sqlite://')) {
          normalizedUrl = 'jdbc:sqlite:' + normalizedUrl.substring(9);
        } else if (normalizedUrl.startsWith('db2://')) {
          normalizedUrl = 'jdbc:db2://' + normalizedUrl.substring(6);
        } else {
          normalizedUrl = 'jdbc:' + normalizedUrl;
        }
      }

      let type: 'POSTGRESQL' | 'MYSQL' | 'ORACLE' | 'DB2' | 'SQLITE' = 'POSTGRESQL';
      let host = '';
      let port = 5432;
      let databaseName = '';
      let username = '';
      let password = '';
      let parsedSuccessfully = false;

      if (normalizedUrl.startsWith('jdbc:postgresql:')) {
        type = 'POSTGRESQL';
        port = 5432;
      } else if (normalizedUrl.startsWith('jdbc:mysql:')) {
        type = 'MYSQL';
        port = 3306;
      } else if (normalizedUrl.startsWith('jdbc:oracle:')) {
        type = 'ORACLE';
        port = 1521;
      } else if (normalizedUrl.startsWith('jdbc:db2:')) {
        type = 'DB2';
        port = 50000;
      } else if (normalizedUrl.startsWith('jdbc:sqlite:')) {
        type = 'SQLITE';
        port = 0;
        const sqliteMatch = normalizedUrl.match(/jdbc:sqlite:(.+)/);
        if (sqliteMatch) {
          databaseName = sqliteMatch[1];
          parsedSuccessfully = true;
        }
      }

      if (type === 'SQLITE') {
        // Handled in block above
      } else if (type === 'ORACLE') {
        const atIdx = normalizedUrl.indexOf('@');
        if (atIdx !== -1) {
          let remainder = normalizedUrl.substring(atIdx + 1);
          if (remainder.startsWith('//')) {
            remainder = remainder.substring(2);
          }
          
          const oracleRegex = /^([^:\/]+)(?::(\d+))?[:\/](.+)$/;
          const oracleMatch = remainder.match(oracleRegex);
          if (oracleMatch) {
            host = oracleMatch[1];
            if (oracleMatch[2]) {
              port = parseInt(oracleMatch[2]);
            }
            databaseName = oracleMatch[3];
            parsedSuccessfully = true;
          } else {
            const parts = remainder.split(/[:\/]/);
            if (parts.length > 0) {
              host = parts[0];
              if (parts.length > 1 && /^\d+$/.test(parts[1])) {
                port = parseInt(parts[1]);
                databaseName = parts.slice(2).join('/');
              } else {
                databaseName = parts.slice(1).join('/');
              }
              parsedSuccessfully = true;
            }
          }
        }
      } else {
        const regex = /jdbc:[a-zA-Z0-9]+:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:\/?;]+)(?::(\d+))?\/([^?;]+)/;
        const match = normalizedUrl.match(regex);
        if (match) {
          username = match[1] || '';
          password = match[2] || '';
          host = match[3] || '';
          if (match[4]) {
            port = parseInt(match[4]);
          }
          databaseName = match[5] || '';
          parsedSuccessfully = true;
        }
      }

      if (parsedSuccessfully) {
        const updated = [...databases];
        updated[idx] = { 
          ...updated[idx], 
          type, 
          host, 
          port, 
          databaseName, 
          username, 
          password 
        };
        setDatabases(updated);
        toast.success("Connection URL successfully parsed and fields populated!");
      } else {
        toast.error("Could not parse this connection URL format. Please enter details manually.");
      }
    } catch (err) {
      toast.error("Failed to parse JDBC Connection URL.");
    }
  };

  const [isValidatingDb, setIsValidatingDb] = useState<Record<number, boolean>>({});

  const handleValidateConnection = async (idx: number) => {
    const db = databases[idx];
    if (!db) return;

    setIsValidatingDb(prev => ({ ...prev, [idx]: true }));
    try {
      const payload = {
        envId: selectedEnv?.id || '',
        databaseId: db.id || '',
        type: db.type,
        host: db.host,
        port: db.port,
        databaseName: db.databaseName,
        username: db.username,
        password: db.password,
        connectionUrl: db.connectionUrl
      };

      const res = await api.post(`/applications/${appId}/environments/validate-db-connection`, payload);
      if (res.data.success) {
        toast.success(res.data.message || "Database connection validated successfully!");
      } else {
        toast.error(res.data.message || "Failed to validate database connection.");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to validate database connection.";
      toast.error(errMsg);
    } finally {
      setIsValidatingDb(prev => ({ ...prev, [idx]: false }));
    }
  };

  const resetTestCaseForm = () => {
    setTcName('');
    setTcDesc('');
    setTcPriority('MEDIUM');
    setTcTags([]);
    setTcTagInput('');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tcTagInput.trim()) {
      e.preventDefault();
      if (!tcTags.includes(tcTagInput.trim())) {
        setTcTags([...tcTags, tcTagInput.trim()]);
      }
      setTcTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTcTags(tcTags.filter(t => t !== tag));
  };

  const handleOpenRun = (tc: TestCaseDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTestCase({ id: tc.id, name: tc.name });
    setIsRunModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <Badge variant="success">Passed</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      case 'RUNNING':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">Running</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isAppLoading) {
    return (
      <div className="flex items-center justify-center py-48">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!appSummary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Application not found</h2>
        <Button onClick={() => navigate('/applications')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Applications
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <button 
            onClick={() => navigate('/applications')}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Applications
          </button>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
              {appSummary.appId || appSummary.id}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">{appSummary.appName || appSummary.name}</h1>
            {!appSummary.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)} className="space-y-6">
        <TabsList className="bg-secondary/40 border border-border/40 p-1 w-full justify-start md:w-auto">
          <TabsTrigger value="overview" onClick={() => setActiveTab('overview')}>Overview</TabsTrigger>
          <TabsTrigger value="environments" onClick={() => setActiveTab('environments')}>Environments ({appSummary.environmentCount})</TabsTrigger>
          <TabsTrigger value="testcases" onClick={() => setActiveTab('testcases')}>Test Cases ({appSummary.testCaseCount})</TabsTrigger>
          <TabsTrigger value="suites" onClick={() => setActiveTab('suites')}>Test Suites</TabsTrigger>
          <TabsTrigger value="executions" onClick={() => setActiveTab('executions')}>Executions ({appSummary.executionCount})</TabsTrigger>
          <TabsTrigger value="collaborators" onClick={() => setActiveTab('collaborators')}>Collaborators</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              className="bg-card/30 border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-card/50 transition-all duration-200 group"
              onClick={() => setActiveTab('environments')}
            >
              <CardHeader>
                <CardDescription className="text-xs uppercase font-semibold">Environments</CardDescription>
                <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
                  <span>{appSummary.environmentCount}</span>
                  <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Configurations for deployment targets.
              </CardContent>
            </Card>

            <Card 
              className="bg-card/30 border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-card/50 transition-all duration-200 group"
              onClick={() => setActiveTab('testcases')}
            >
              <CardHeader>
                <CardDescription className="text-xs uppercase font-semibold">Test Cases</CardDescription>
                <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
                  <span>{appSummary.testCaseCount}</span>
                  <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Sequential visual workflow testing scenarios.
              </CardContent>
            </Card>

            <Card 
              className="bg-card/30 border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-card/50 transition-all duration-200 group"
              onClick={() => setActiveTab('executions')}
            >
              <CardHeader>
                <CardDescription className="text-xs uppercase font-semibold">Total Test Runs</CardDescription>
                <CardTitle className="text-3xl font-extrabold flex items-center justify-between">
                  <span>{appSummary.executionCount}</span>
                  <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Consolidated run execution records.
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/50 bg-card/20">
            <CardHeader>
              <CardTitle className="text-lg font-bold">About {appSummary.appName || appSummary.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border/40 pb-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Project ID (prId)</span>
                  <span className="font-semibold text-foreground">{appSummary.prId || '--'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Platform ID (plId)</span>
                  <span className="font-semibold text-foreground">{appSummary.plId || '--'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Owner</span>
                  <span className="font-semibold text-foreground">{appSummary.owner || '--'}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {appSummary.description || 'No description available for this application. Use the application editor to add detail.'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENVIRONMENTS TAB */}
        <TabsContent value="environments" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Environments</h3>
              <p className="text-xs text-muted-foreground">Key-value configurations and credentials scoped to this app</p>
            </div>
            {user?.role !== 'VIEWER' && (
              <Button size="sm" onClick={handleOpenEnvCreate}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Environment
              </Button>
            )}
          </div>

          {isEnvsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !environments || environments.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <Sliders className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="font-semibold">No environments configured</h4>
              <p className="text-xs text-muted-foreground mt-1">Add dev, staging, or production environments to customize workflow runs.</p>
              {user?.role !== 'VIEWER' && (
                <Button size="sm" onClick={handleOpenEnvCreate} className="mt-3">
                  Create Environment
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {environments.map((env) => (
                <Card 
                  key={env.id} 
                  className="border border-border/50 bg-card/20 hover:border-primary/30 transition-all flex flex-col justify-between group cursor-pointer h-[155px] p-5"
                  onClick={() => handleOpenEnvDrawer(env)}
                >
                  {/* Top: Name, Type label, and actions */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Environment</span>
                        {!env.isActive && <Badge variant="secondary" className="text-[9px] px-1 py-0">Inactive</Badge>}
                        {env.isDefault && (
                          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] px-1 py-0 select-none flex items-center gap-0.5 shrink-0">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Default
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-base font-bold group-hover:text-primary transition-colors truncate mt-1.5">{env.name}</h4>
                    </div>
                    
                    {user?.role !== 'VIEWER' && (
                      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-7 w-7", env.isDefault ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500")}
                          title={env.isDefault ? "Default Environment" : "Set as Default"} 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (!env.isDefault) setDefaultEnvMutation.mutate(env.id); 
                          }}
                        >
                          <Star className={cn("h-3.5 w-3.5", env.isDefault && "fill-amber-500")} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenEnvEdit(env); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); cloneEnvMutation.mutate(env.id); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteEnvMutation.mutate(env.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Middle: Description */}
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {env.description || 'No description provided.'}
                  </p>

                  {/* Bottom: Variables count and arrow */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/10 pt-2.5 mt-2">
                    <span>Variables: <span className="font-semibold text-foreground">{env.variables.length}</span></span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1 shrink-0" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {environments && environments.length > 1 && (
            <div className="pt-6 border-t border-border/20">
              <EnvVariableDiff environments={environments} />
            </div>
          )}
        </TabsContent>

        {/* TEST CASES TAB */}
        <TabsContent value="testcases" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold">Test Cases</h3>
              <p className="text-xs text-muted-foreground">Workflow definitions targeting this application</p>
            </div>
            {appSummary?.hasEditAccess && (
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => { setImportName(''); setImportFile(null); setImportType('yaml'); setValidationResult(null); setValidationErrors([]); setValidationWarnings([]); setIsImportModalOpen(true); }}>
                  <Download className="mr-1.5 h-4 w-4 rotate-180" /> Import Test Case
                </Button>
                <Button size="sm" onClick={() => { resetTestCaseForm(); setIsTestCaseModalOpen(true); }}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create Test Case
                </Button>
              </div>
            )}
          </div>

          {isTestCasesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !testCases?.content || testCases.content.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <Code className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="font-semibold">No test cases found</h4>
              <p className="text-xs text-muted-foreground mt-1">Combine visual workflow test steps into test scenarios.</p>
              {appSummary?.hasEditAccess && (
                <div className="flex justify-center space-x-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setImportName(''); setImportFile(null); setImportType('yaml'); setValidationResult(null); setValidationErrors([]); setValidationWarnings([]); setIsImportModalOpen(true); }}>
                    <Download className="mr-1.5 h-4 w-4 rotate-180" /> Import Test Case
                  </Button>
                  <Button size="sm" onClick={() => { resetTestCaseForm(); setIsTestCaseModalOpen(true); }}>
                    Create Test Case
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testCases.content.map((tc) => (
                <Card 
                  key={tc.id} 
                  className="border border-border/50 bg-card/20 hover:border-primary/30 transition-all flex flex-col justify-between group cursor-pointer"
                  onClick={() => navigate(`/applications/${appId}/testcases/${tc.id}/designer`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-sm font-bold truncate group-hover:text-primary transition-colors">{tc.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-1 min-h-[32px]">{tc.description || 'No description'}</CardDescription>
                      </div>
                      <Badge variant={tc.priority === 'CRITICAL' || tc.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                        {tc.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 flex-1">
                    <div className="flex flex-wrap gap-1">
                      {tc.tags && tc.tags.map((t, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] py-0 px-1.5">{t}</Badge>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-border/20 py-2.5 px-6 flex items-center justify-between bg-secondary/10">
                    <span className="text-[11px] text-muted-foreground">Steps: {tc.stepCount}</span>
                    <div className="flex items-center space-x-1">
                      {appSummary?.hasEditAccess && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={(e) => handleOpenRun(tc, e)}
                        >
                          <Play className="h-4 w-4 fill-emerald-400/20" />
                        </Button>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); handleExportTestCase(tc.id, tc.name); }}
                        title="Export to YAML"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>

                      {appSummary?.hasEditAccess && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); cloneTestCaseMutation.mutate(tc.id); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteTestCaseMutation.mutate(tc.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TEST SUITES TAB */}
        <TabsContent value="suites" className="space-y-6">
          <TestSuiteTab appId={appId!} hasEditAccess={!!appSummary?.hasEditAccess} />
        </TabsContent>

        {/* EXECUTIONS TAB */}
        <TabsContent value="executions" className="space-y-6">
          <div>
            <h3 className="text-lg font-bold">Execution History</h3>
            <p className="text-xs text-muted-foreground font-normal">Recent logs of executed tests</p>
          </div>

          {isExecsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !executions?.content || executions.content.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h4 className="font-semibold">No run records found</h4>
              <p className="text-xs text-muted-foreground mt-1">Execution tracking details appear here after starting test cases.</p>
            </Card>
          ) : (
            <Card className="border border-border/50 bg-card/20 overflow-hidden">
              <div className="divide-y divide-border/40">
                {executions.content.map((exec) => (
                  <div key={exec.id} className="p-4 hover:bg-secondary/15 transition-colors flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm hover:text-primary cursor-pointer truncate" onClick={() => navigate(`/executions/${exec.id}`)}>
                          {exec.testCaseName || `Run #${exec.id.substring(0, 8)}`}
                        </span>
                        {getStatusBadge(exec.status)}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Duration: {exec.durationMs ? `${(exec.durationMs / 1000).toFixed(2)}s` : '--'}</span>
                        <span>Env: <span className="text-foreground font-medium">{exec.environmentName}</span></span>
                        <span>Steps passed: {exec.passedSteps}/{exec.totalSteps}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/executions/${exec.id}`)}>
                      Logs
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsTab appId={appId!} createdBy={appSummary.createdBy} />
        </TabsContent>
      </Tabs>

      {/* ── ENVIRONMENT MODAL ────────────────────────────────────────────────── */}
      <Dialog isOpen={isEnvModalOpen} onClose={() => setIsEnvModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>{selectedEnv ? 'Edit Environment Metadata' : 'Add Environment'}</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Environment Name (CAPS only)</label>
            <Input 
              value={envName} 
              onChange={(e) => setEnvName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} 
              placeholder="e.g. STAGING" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={envDesc} onChange={(e) => setEnvDesc(e.target.value)} placeholder="Staging environment description..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEnvModalOpen(false)}>Cancel</Button>
          <Button onClick={() => saveEnvMutation.mutate()} disabled={saveEnvMutation.isPending || !envName.trim()}>
            {saveEnvMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── ENVIRONMENT VARIABLES SIDEBAR DRAWER ── */}
      {isEnvDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsEnvDrawerOpen(false)} 
          />
          
          {/* Drawer Box */}
          <div className="relative bg-card border-l border-border text-card-foreground w-full max-w-5xl h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-border/40 flex justify-between items-center bg-secondary/10 shrink-0">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Environment Settings</span>
                <h3 className="text-lg font-bold text-foreground mt-1">{selectedEnv?.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedEnv?.description || 'No description'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsEnvDrawerOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-border/40 px-6 bg-secondary/5 shrink-0">
              {[
                { id: 'variables', label: 'Variables', count: variables.length, icon: Sliders },
                { id: 'databases', label: 'Database Connections', count: databases.length, icon: Globe },
                { id: 'datasets', label: 'Datasets (CSV)', count: datasets.length, icon: FileJson }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = drawerActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-all ${
                      isActive 
                        ? 'border-primary text-primary bg-primary/5' 
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-primary/20 text-primary' : 'bg-secondary/40 text-muted-foreground'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {drawerActiveTab === 'variables' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-border/10">
                    <h4 className="text-sm font-bold text-foreground">Variables ({variables.length})</h4>
                    {user?.role !== 'VIEWER' && (
                      <Button size="sm" variant="secondary" onClick={addVariableRow} className="h-8">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Row
                      </Button>
                    )}
                  </div>

                  {variables.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border/40 rounded-lg text-muted-foreground">
                      <Sliders className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs">No variables added yet. Variables allow dynamic parameter interpolation in HTTP requests and script steps.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Headers Row */}
                      <div className="flex items-center gap-3 px-3 text-xs font-semibold text-muted-foreground">
                        <div className="w-[220px]">Variable Key</div>
                        <div className="flex-1">Value</div>
                        <div className="flex-1">Description (Optional)</div>
                        {user?.role !== 'VIEWER' && <div className="w-9 shrink-0"></div>}
                      </div>

                      {variables.map((variable, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-secondary/15 border border-border/30 rounded-md p-3 relative group/row animate-in fade-in duration-150">
                          {/* KEY field */}
                          <div className="w-[220px] shrink-0">
                            <Input 
                              placeholder="KEY (e.g. AUTH_TOKEN)" 
                              value={variable.key} 
                              disabled={user?.role === 'VIEWER'}
                              onChange={(e) => updateVariable(idx, 'key', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                              className="h-9 text-xs font-mono"
                            />
                          </div>
                          
                          {/* VALUE field + Secret Toggle */}
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <Input 
                              placeholder="Value" 
                              type={variable.isSecret ? "password" : "text"} 
                              value={variable.value} 
                              disabled={user?.role === 'VIEWER'}
                              onChange={(e) => updateVariable(idx, 'value', e.target.value)}
                              className="h-9 text-xs font-mono flex-1"
                            />
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={user?.role === 'VIEWER'}
                              className={cn(
                                "h-9 w-9 text-muted-foreground shrink-0 border border-border/40 hover:bg-secondary/40", 
                                variable.isSecret && "text-primary bg-primary/5 border-primary/20"
                              )} 
                              onClick={() => updateVariable(idx, 'isSecret', !variable.isSecret)}
                              title="Toggle Secret"
                            >
                              {variable.isSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>

                          {/* DESCRIPTION field */}
                          <div className="flex-1 min-w-0">
                            <Input 
                              placeholder="Short description..." 
                              value={variable.description || ''} 
                              disabled={user?.role === 'VIEWER'}
                              onChange={(e) => updateVariable(idx, 'description', e.target.value)}
                              className="h-9 text-xs flex-1"
                            />
                          </div>
                          
                          {/* DELETE action */}
                          {user?.role !== 'VIEWER' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0 border border-border/40 hover:bg-destructive/10" 
                              onClick={() => removeVariableRow(idx)}
                              title="Delete Variable"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === 'databases' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-border/10">
                    <h4 className="text-sm font-bold text-foreground">Database Connections ({databases.length})</h4>
                    {user?.role !== 'VIEWER' && (
                      <Button size="sm" variant="secondary" onClick={addDatabaseRow} className="h-8">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Database
                      </Button>
                    )}
                  </div>

                  {databases.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border/40 rounded-lg text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs">No database connections configured. Target databases can be PostgreSQL, MySQL, Oracle, or SQLite.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {databases.map((db, idx) => (
                        <div key={db.id || idx} className="bg-secondary/15 border border-border/30 rounded-md p-4 space-y-3 relative animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary">Connection #{idx + 1}</span>
                            {user?.role !== 'VIEWER' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive border border-border/40 hover:bg-destructive/10" 
                                onClick={() => removeDatabaseRow(idx)}
                                title="Delete Connection"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Database Key / Name</label>
                              <Input 
                                placeholder="e.g. PRIMARY_DB" 
                                value={db.name} 
                                disabled={user?.role === 'VIEWER'}
                                onChange={(e) => updateDatabase(idx, 'name', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                className="h-9 text-xs font-mono"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Engine Type</label>
                              <Select
                                options={[
                                  { value: 'POSTGRESQL', label: 'PostgreSQL / CockroachDB' },
                                  { value: 'MYSQL', label: 'MySQL' },
                                  { value: 'ORACLE', label: 'Oracle' },
                                  { value: 'DB2', label: 'IBM DB2 (supports Env Cert)' },
                                  { value: 'SQLITE', label: 'SQLite' },
                                ]}
                                value={db.type}
                                disabled={user?.role === 'VIEWER'}
                                onChange={(e) => updateDatabase(idx, 'type', e.target.value as any)}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                                {db.type === 'SQLITE' ? 'SQLite DB File Path' : 'Database Name'}
                              </label>
                              <Input 
                                placeholder={db.type === 'SQLITE' ? 'e.g. ./orion.db' : 'e.g. user_db'} 
                                value={db.databaseName} 
                                disabled={user?.role === 'VIEWER'}
                                onChange={(e) => updateDatabase(idx, 'databaseName', e.target.value)}
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Raw Connection URL (Optional Override)</label>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="e.g. jdbc:postgresql://localhost:5432/mydb?sslmode=require&sslrootcert={{CERT_PATH}}" 
                                value={db.connectionUrl || ''} 
                                disabled={user?.role === 'VIEWER'}
                                onChange={(e) => updateDatabase(idx, 'connectionUrl', e.target.value)}
                                className="h-9 text-xs font-mono flex-1 bg-background/30"
                              />
                              {db.connectionUrl && user?.role !== 'VIEWER' && (
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => handleParseUrl(idx, db.connectionUrl || '')}
                                  className="h-9 text-xs"
                                >
                                  Parse URL
                                </Button>
                              )}
                            </div>
                            <p className="text-[9px] text-muted-foreground">Use placeholders like <code>{"{{CERT_PATH}}"}</code> (or a custom keyword) to dynamically inject temporary certificate paths.</p>
                          </div>

                          {db.type !== 'SQLITE' && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                              <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Host</label>
                                <Input 
                                  placeholder="e.g. localhost or 10.0.0.5" 
                                  value={db.host || ''} 
                                  disabled={user?.role === 'VIEWER'}
                                  onChange={(e) => updateDatabase(idx, 'host', e.target.value)}
                                  className="h-9 text-xs"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Port</label>
                                <Input 
                                  type="number"
                                  placeholder={db.type === 'MYSQL' ? '3306' : db.type === 'ORACLE' ? '1521' : db.type === 'DB2' ? '50000' : '5432'} 
                                  value={db.port || (db.type === 'MYSQL' ? 3306 : db.type === 'ORACLE' ? 1521 : db.type === 'DB2' ? 50000 : 5432)} 
                                  disabled={user?.role === 'VIEWER'}
                                  onChange={(e) => updateDatabase(idx, 'port', parseInt(e.target.value) || (db.type === 'MYSQL' ? 3306 : db.type === 'ORACLE' ? 1521 : db.type === 'DB2' ? 50000 : 5432))}
                                  className="h-9 text-xs"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Username</label>
                                <Input 
                                  placeholder="e.g. postgres" 
                                  value={db.username || ''} 
                                  disabled={user?.role === 'VIEWER'}
                                  onChange={(e) => updateDatabase(idx, 'username', e.target.value)}
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>
                          )}

                          {db.type !== 'SQLITE' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Password</label>
                                <Input 
                                  type="password"
                                  placeholder="Password" 
                                  value={db.password || ''} 
                                  disabled={user?.role === 'VIEWER'}
                                  onChange={(e) => updateDatabase(idx, 'password', e.target.value)}
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>
                          )}
                          
                          {user?.role !== 'VIEWER' && (
                            <div className="flex justify-end pt-2 border-t border-border/10">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={isValidatingDb[idx]}
                                onClick={() => handleValidateConnection(idx)}
                                className="text-xs font-bold gap-1.5 h-8 cursor-pointer"
                              >
                                {isValidatingDb[idx] ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                                )}
                                Validate Connection
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerActiveTab === 'datasets' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-border/10 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-primary" /> Environment CSV Datasets
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Upload CSV files to parse dynamic test values automatically during execution runs.</p>
                    </div>
                    {user?.role !== 'VIEWER' && (
                      <Button size="sm" onClick={addDatasetRow}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Dataset
                      </Button>
                    )}
                  </div>

                  {datasets.length === 0 ? (
                    <Card className="text-center py-10 border-dashed">
                      <FileJson className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                      <h5 className="text-sm font-semibold">No datasets uploaded</h5>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Add environment-level spreadsheets containing parameter combinations.</p>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {datasets.map((ds, idx) => (
                        <div key={ds.id || idx} className="border border-border/40 bg-secondary/5 rounded-lg p-4 space-y-3 relative group">
                          {user?.role !== 'VIEWER' && (
                            <button
                              type="button"
                              onClick={() => removeDatasetRow(idx)}
                              className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Dataset Key/Name</label>
                              <Input
                                placeholder="e.g. TestAccounts"
                                value={ds.name}
                                disabled={user?.role === 'VIEWER'}
                                onChange={(e) => updateDataset(idx, 'name', e.target.value)}
                                className="h-9 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase text-muted-foreground">Upload CSV File</label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="file"
                                  accept=".csv"
                                  disabled={user?.role === 'VIEWER'}
                                  onChange={(e) => handleDatasetCsvUpload(idx, e)}
                                  className="block w-full text-xs text-muted-foreground border border-border rounded-lg cursor-pointer bg-background p-1.5 focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {ds.filename && (
                            <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground">
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                              <span>Active file: <span className="font-semibold text-foreground">{ds.filename}</span></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/40 bg-secondary/20 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEnvDrawerOpen(false)}>Cancel</Button>
              {user?.role !== 'VIEWER' && (
                <Button onClick={handleSaveEnvVariables} disabled={saveEnvMutation.isPending}>
                  {saveEnvMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TEST CASE MODAL ──────────────────────────────────────────────────── */}
      <Dialog isOpen={isTestCaseModalOpen} onClose={() => setIsTestCaseModalOpen(false)} size="2xl">
        <DialogHeader>
          <DialogTitle>Create Test Case</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input value={tcName} onChange={(e) => setTcName(e.target.value)} placeholder="e.g. Verify User Signup API" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={tcDesc} onChange={(e) => setTcDesc(e.target.value)} placeholder="Enter brief test objectives..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Priority</label>
            <Select 
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
              value={tcPriority}
              onChange={(e) => setTcPriority(e.target.value as any)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags (Press Enter to add)</label>
            <Input 
              value={tcTagInput} 
              onChange={(e) => setTcTagInput(e.target.value)} 
              onKeyDown={handleAddTag} 
              placeholder="e.g. auth"
            />
            {tcTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tcTags.map(t => (
                  <Badge key={t} variant="secondary" className="flex items-center space-x-1.5 pr-1">
                    <span>{t}</span>
                    <button type="button" onClick={() => handleRemoveTag(t)} className="text-muted-foreground hover:text-foreground">×</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsTestCaseModalOpen(false)}>Cancel</Button>
          <Button onClick={() => saveTestCaseMutation.mutate()} disabled={saveTestCaseMutation.isPending || !tcName.trim()}>
            {saveTestCaseMutation.isPending ? 'Creating...' : 'Save & Open Designer'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── IMPORT TEST CASE MODAL ────────────────────────────────────────────── */}
      <Dialog isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setValidationResult(null); }} size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Download className="mr-2 h-5 w-5 text-primary rotate-180" />
            Import Test Case
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div className="flex space-x-4 border-b border-border pb-3">
            <button
              onClick={() => { setImportType('yaml'); setImportFile(null); setValidationResult(null); }}
              className={cn(
                "pb-2 text-sm font-semibold border-b-2 px-1 transition-all",
                importType === 'yaml' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Orion Test Case YAML
            </button>
            <button
              onClick={() => { setImportType('openapi'); setImportFile(null); setValidationResult(null); }}
              className={cn(
                "pb-2 text-sm font-semibold border-b-2 px-1 transition-all",
                importType === 'openapi' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              OpenAPI / Swagger Spec
            </button>
          </div>

          {importType === 'yaml' ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Select Orion YAML File</label>
                <input 
                  type="file" 
                  accept=".yaml,.yml,.json" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                      handleValidateYaml(file);
                    }
                  }}
                  className="block w-full text-xs text-muted-foreground border border-border rounded-lg cursor-pointer bg-secondary/10 p-2.5 focus:outline-none" 
                />
              </div>

              {isValidating && (
                <div className="flex items-center justify-center py-6 space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Validating test case structure...</span>
                </div>
              )}

              {validationResult && (
                <div className="space-y-3 p-4 bg-secondary/10 border border-border/50 rounded-lg animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{validationResult.testCaseName || 'Unnamed Test Case'}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{validationResult.testCaseDescription || 'No description provided'}</p>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {validationResult.stepCount} steps found
                    </Badge>
                  </div>

                  {validationErrors.length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs space-y-1">
                      <div className="font-semibold flex items-center">
                        <XCircle className="h-4 w-4 mr-1 shrink-0" />
                        YAML structure errors (Import disabled):
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationWarnings.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-400 text-xs space-y-1">
                      <div className="font-semibold flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1 shrink-0" />
                        Validation warnings:
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {validationWarnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationErrors.length === 0 && (
                    <div className="flex items-center text-xs text-emerald-400 font-medium">
                      <CheckCircle className="h-4 w-4 mr-1 shrink-0" />
                      YAML file is structurally valid and ready to import.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Test Case Name</label>
                <Input 
                  value={importName} 
                  onChange={(e) => setImportName(e.target.value)} 
                  placeholder="e.g. Petstore API Flows" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Specification File (JSON or YAML)</label>
                <input 
                  type="file" 
                  accept=".json,.yaml,.yml" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                      if (!importName) {
                        const baseName = file.name.replace(/\.[^/.]+$/, "");
                        setImportName(baseName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
                      }
                    }
                  }}
                  className="block w-full text-xs text-muted-foreground border border-border rounded-lg cursor-pointer bg-secondary/10 p-2.5 focus:outline-none" 
                />
                <p className="text-[10px] text-muted-foreground">
                  Select any valid OpenAPI v3 or Swagger v2 documentation schema file to automatically parse routes into HTTP workflow steps.
                </p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setValidationResult(null); }}>Cancel</Button>
          {importType === 'yaml' ? (
            <Button 
              onClick={() => importYamlTestCaseMutation.mutate()} 
              disabled={importYamlTestCaseMutation.isPending || isValidating || !importFile || validationErrors.length > 0}
            >
              {importYamlTestCaseMutation.isPending ? 'Importing...' : 'Confirm Import'}
            </Button>
          ) : (
            <Button 
              onClick={() => importTestCaseMutation.mutate()} 
              disabled={importTestCaseMutation.isPending || !importName.trim() || !importFile}
            >
              {importTestCaseMutation.isPending ? 'Importing...' : 'Import & Open Designer'}
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* ── RUN TEST DIALOG ─────────────────────────────────────────────────── */}
      {selectedTestCase && (
        <RunTestDialog
          isOpen={isRunModalOpen}
          onClose={() => { setIsRunModalOpen(false); setSelectedTestCase(null); }}
          appId={appId!}
          testCaseId={selectedTestCase.id}
          testCaseName={selectedTestCase.name}
        />
      )}
    </div>
  );
};
export default ApplicationDetailPage;
