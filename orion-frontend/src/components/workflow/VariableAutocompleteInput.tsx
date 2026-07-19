import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { EnvironmentDto } from '../../types/api';
import { useWorkflowStore } from '../../stores/workflow-store';
import { Variable, Sparkles, Layers, Globe, Search } from 'lucide-react';
import { Input, Textarea } from '../ui';

interface SuggestionItem {
  key: string;
  placeholder: string;
  category: 'ENV' | 'STEP_OUTPUT' | 'FAKER';
  label: string;
  detail?: string;
}

const FAKER_ITEMS: SuggestionItem[] = [
  { key: '$randomEmail', placeholder: '{{$randomEmail}}', category: 'FAKER', label: 'Random Email Address', detail: 'e.g. user984@example.com' },
  { key: '$randomUUID', placeholder: '{{$randomUUID}}', category: 'FAKER', label: 'Random UUID / GUID', detail: 'e.g. 550e8400-e29b-41d4-a716-446655440000' },
  { key: '$randomFirstName', placeholder: '{{$randomFirstName}}', category: 'FAKER', label: 'Random First Name', detail: 'e.g. Alex' },
  { key: '$randomLastName', placeholder: '{{$randomLastName}}', category: 'FAKER', label: 'Random Last Name', detail: 'e.g. Morgan' },
  { key: '$randomPhoneNumber', placeholder: '{{$randomPhoneNumber}}', category: 'FAKER', label: 'Random Phone Number', detail: 'e.g. +1-555-0199' },
  { key: '$timestamp', placeholder: '{{$timestamp}}', category: 'FAKER', label: 'Current Epoch Timestamp (ms)', detail: 'e.g. 1721410000000' },
  { key: '$isoDate', placeholder: '{{$isoDate}}', category: 'FAKER', label: 'Current ISO Date String', detail: 'e.g. 2026-07-19T23:00:00Z' },
  { key: '$randomInt', placeholder: '{{$randomInt}}', category: 'FAKER', label: 'Random Integer (1-1000)', detail: 'e.g. 742' },
];

interface VariableAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  disabled?: boolean;
  label?: string;
}

export const VariableAutocompleteInput: React.FC<VariableAutocompleteInputProps> = ({
  value = '',
  onChange,
  placeholder,
  className = '',
  multiline = false,
  rows = 3,
  type = 'text',
  disabled = false,
  label
}) => {
  const { appId } = useParams<{ appId: string }>();
  const { steps } = useWorkflowStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Fetch application environments for env variables
  const { data: environments = [] } = useQuery<EnvironmentDto[]>({
    queryKey: ['environments', appId],
    queryFn: async () => {
      const res = await api.get(`/applications/${appId}/environments`);
      return res.data;
    },
    enabled: !!appId,
  });

  // Calculate available variable suggestions
  const suggestions = useMemo(() => {
    const list: SuggestionItem[] = [];

    // 1. Environment & Secret variables
    const seenEnv = new Set<string>();
    environments.forEach((env) => {
      (env.variables || []).forEach((v) => {
        if (v.key && !seenEnv.has(v.key)) {
          seenEnv.add(v.key);
          list.push({
            key: v.key,
            placeholder: `{{${v.key}}}`,
            category: 'ENV',
            label: v.key,
            detail: `Env Var (${env.name || 'Environment'})`
          });
        }
      });
      (env.secrets || []).forEach((s) => {
        if (s.key && !seenEnv.has(s.key)) {
          seenEnv.add(s.key);
          list.push({
            key: s.key,
            placeholder: `{{${s.key}}}`,
            category: 'ENV',
            label: s.key,
            detail: `Env Secret (${env.name || 'Environment'})`
          });
        }
      });
    });

    // 2. Preceding step output variables
    steps.forEach((s) => {
      const cfg = s.config || {};
      const addStepVar = (varName?: string, desc?: string) => {
        if (varName && varName.trim()) {
          const k = varName.trim();
          list.push({
            key: k,
            placeholder: `{{${k}}}`,
            category: 'STEP_OUTPUT',
            label: k,
            detail: desc || `Step ${s.sequenceOrder}: ${s.name}`
          });
        }
      };

      addStepVar((cfg as any).targetVariable, `Saved from Step ${s.sequenceOrder}`);
      addStepVar((cfg as any).saveAsVariable, `Saved from Step ${s.sequenceOrder}`);
      addStepVar((cfg as any).variableName, `Extracted in Step ${s.sequenceOrder}`);
      addStepVar((cfg as any).outputVariable, `Output of Step ${s.sequenceOrder}`);

      if (Array.isArray((cfg as any).variables)) {
        (cfg as any).variables.forEach((item: any) => {
          addStepVar(item?.variableName || item?.key || item?.name, `Set in Step ${s.sequenceOrder}`);
        });
      }
      if (Array.isArray((cfg as any).extractors)) {
        (cfg as any).extractors.forEach((item: any) => {
          addStepVar(item?.variableName || item?.targetVariable || item?.key, `Extracted in Step ${s.sequenceOrder}`);
        });
      }
    });

    // 3. Faker dynamic expressions
    FAKER_ITEMS.forEach((item) => list.push(item));

    return list;
  }, [environments, steps]);

  const filteredSuggestions = useMemo(() => {
    if (!search.trim()) return suggestions;
    const q = search.toLowerCase();
    return suggestions.filter(
      (s) => s.key.toLowerCase().includes(q) || s.label.toLowerCase().includes(q) || (s.detail && s.detail.toLowerCase().includes(q))
    );
  }, [suggestions, search]);

  // Handle typing detection for `{{`
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    if (newVal.endsWith('{{')) {
      setIsOpen(true);
      setSearch('');
    }
  };

  const handleSelectSuggestion = (suggestion: SuggestionItem) => {
    let newVal = value;
    // If text ends with `{{`, replace trailing `{{` with `{{key}}`
    if (newVal.endsWith('{{')) {
      newVal = newVal.slice(0, -2) + suggestion.placeholder;
    } else if (newVal.endsWith('{')) {
      newVal = newVal.slice(0, -1) + suggestion.placeholder;
    } else {
      newVal = newVal ? `${newVal} ${suggestion.placeholder}` : suggestion.placeholder;
    }
    onChange(newVal);
    setIsOpen(false);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Close popup on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-extrabold uppercase text-muted-foreground">{label}</label>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-[9px] font-extrabold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
            title="Open Variable IntelliSense"
          >
            <Variable className="h-3 w-3" />
            <span>Insert {"{{var}}"}</span>
          </button>
        </div>
      )}

      <div className="relative flex items-center">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className={`${className} pr-7 font-mono text-xs`}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`${className} pr-7 text-xs`}
          />
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-2.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer z-10"
          title="Toggle Variable Autocomplete"
        >
          <Variable className="h-3.5 w-3.5 text-indigo-400" />
        </button>
      </div>

      {/* Autocomplete Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-border/40 bg-secondary/20 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variables & faker expressions..."
              className="w-full text-xs bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
            {filteredSuggestions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching variables found.
              </div>
            ) : (
              filteredSuggestions.map((item, idx) => (
                <button
                  key={`${item.key}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full flex items-center justify-between p-1.5 px-2 rounded-md hover:bg-secondary/60 text-left cursor-pointer transition-all text-xs"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    {item.category === 'ENV' && <Globe className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                    {item.category === 'STEP_OUTPUT' && <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                    {item.category === 'FAKER' && <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />}

                    <code className="font-mono text-[11px] font-bold text-primary truncate">
                      {item.placeholder}
                    </code>
                  </div>

                  <span className="text-[9px] text-muted-foreground font-mono shrink-0 ml-2 truncate max-w-[140px]">
                    {item.detail || item.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableAutocompleteInput;
