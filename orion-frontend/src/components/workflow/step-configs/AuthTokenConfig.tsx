import React from 'react';
import { Input, Select } from '../../ui';
import { TestStepDto } from '../../../types/api';

interface AuthTokenConfigProps {
  step: TestStepDto;
  handleConfigChange: (key: string, value: any) => void;
}

export const AuthTokenConfig: React.FC<AuthTokenConfigProps> = ({
  step,
  handleConfigChange
}) => {
  const authType = step.config.authType || 'BASIC';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Auth Token Type</label>
        <Select
          options={[
            { value: 'BASIC', label: 'Basic Authentication' },
            { value: 'OAUTH2_CLIENT_CREDENTIALS', label: 'OAuth 2.0 (Client Credentials)' },
            { value: 'OAUTH2_PASSWORD', label: 'OAuth 2.0 (Resource Owner Password)' },
            { value: 'API_KEY', label: 'API Key' },
          ]}
          value={authType}
          onChange={(e) => handleConfigChange('authType', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase text-muted-foreground">Target Variable Name</label>
        <Input
          placeholder="e.g. authToken"
          value={step.config.targetVariable || 'authToken'}
          onChange={(e) => handleConfigChange('targetVariable', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">The generated/fetched token value will be saved to this context variable.</p>
      </div>

      <div className="p-2.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <span>⚡ Automatic Background Token Refresh</span>
        </div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          OAuth 2.0 tokens (including 30-min TTL expirations) and tokens receiving 401 Unauthorized are automatically refreshed in the background before expiration. Only 1 Auth Token step is required per test case!
        </p>
      </div>

      <hr className="border-border/60" />

      {authType === 'BASIC' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Username</label>
            <Input
              placeholder="Username"
              value={step.config.username || ''}
              onChange={(e) => handleConfigChange('username', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Password</label>
            <Input
              type="password"
              placeholder="Password"
              value={step.config.password || ''}
              onChange={(e) => handleConfigChange('password', e.target.value)}
            />
          </div>
        </div>
      )}

      {(authType === 'OAUTH2_CLIENT_CREDENTIALS' || authType === 'OAUTH2_PASSWORD') && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Token URL <span className="text-destructive">*</span></label>
            <Input
              placeholder="e.g. https://auth.example.com/oauth/token"
              value={step.config.tokenUrl || ''}
              onChange={(e) => handleConfigChange('tokenUrl', e.target.value)}
            />
          </div>
          {authType === 'OAUTH2_PASSWORD' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Username</label>
                <Input
                  placeholder="Username"
                  value={step.config.username || ''}
                  onChange={(e) => handleConfigChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="Password"
                  value={step.config.password || ''}
                  onChange={(e) => handleConfigChange('password', e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Client ID</label>
              <Input
                placeholder="Client ID"
                value={step.config.clientId || ''}
                onChange={(e) => handleConfigChange('clientId', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Client Secret</label>
              <Input
                type="password"
                placeholder="Client Secret"
                value={step.config.clientSecret || ''}
                onChange={(e) => handleConfigChange('clientSecret', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Scope (optional)</label>
            <Input
              placeholder="e.g. read write"
              value={step.config.scope || ''}
              onChange={(e) => handleConfigChange('scope', e.target.value)}
            />
          </div>
        </div>
      )}

      {authType === 'API_KEY' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Key Name</label>
            <Input
              placeholder="e.g. x-api-key"
              value={step.config.keyName || 'x-api-key'}
              onChange={(e) => handleConfigChange('keyName', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Key Value</label>
            <Input
              placeholder="e.g. key_12345abcdef"
              value={step.config.keyValue || ''}
              onChange={(e) => handleConfigChange('keyValue', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
