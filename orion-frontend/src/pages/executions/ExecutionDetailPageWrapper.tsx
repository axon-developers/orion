import React from 'react';
import { useSystemSettingsStore } from '../../stores/system-settings-store';
import ExecutionDetailPage from './ExecutionDetailPage';
import ExecutionDetailPageV2 from './ExecutionDetailPageV2';

export const ExecutionDetailPageWrapper: React.FC = () => {
  const { getSetting } = useSystemSettingsStore();
  const version = getSetting('ui.execution_page_version', 'v2');

  if (version === 'v1') {
    return <ExecutionDetailPage />;
  }

  return <ExecutionDetailPageV2 />;
};

export default ExecutionDetailPageWrapper;
