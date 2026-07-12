import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Shared colour palette (GitHub dark-dimmed style)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  // JSON
  jsonKey:     'text-[#ff7b72] font-semibold',
  jsonStr:     'text-[#7ee787]',
  jsonNum:     'text-[#79c0ff]',
  jsonBool:    'text-[#ff9b50]',
  jsonNull:    'text-[#8b949e] italic',
  bracket:     'text-[#8b949e]',
  index:       'text-[#8b949e] select-none mr-1.5 tabular-nums text-[10px]',
  // XML
  xmlTag:      'text-[#7ee787]',          // element name  — green
  xmlAttrKey:  'text-[#79c0ff]',          // attribute name — blue
  xmlAttrVal:  'text-[#a5d6ff]',          // attribute value — light blue
  xmlText:     'text-[#c9d1d9]',          // text content — white
  xmlPunct:    'text-[#8b949e]',          // <  >  /  =  " — grey
  xmlNs:       'text-[#ffa657]',          // namespace prefix — orange
  xmlProcInst: 'text-[#8b949e] italic',   // <?xml ... ?>
  xmlComment:  'text-[#6e7681] italic',   // <!-- ... -->
};

// ═════════════════════════════════════════════════════════════════════════════
// JSON TREE
// ═════════════════════════════════════════════════════════════════════════════

function PrimitiveValue({ value }: { value: unknown }) {
  if (value === null)          return <span className={C.jsonNull}>null</span>;
  if (typeof value === 'boolean')
    return <span className={C.jsonBool}>{value ? 'true' : 'false'}</span>;
  if (typeof value === 'number')
    return <span className={C.jsonNum}>{value}</span>;
  if (typeof value === 'string')
    return <span className={C.jsonStr}>&quot;{value}&quot;</span>;
  return <span className={C.xmlText}>{String(value)}</span>;
}

interface JsonNodeProps {
  nodeKey?: string | number;
  value: unknown;
  depth: number;
  isLast?: boolean;
}

function JsonNode({ nodeKey, value, depth, isLast = true }: JsonNodeProps) {
  const isObj   = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const [open, setOpen] = useState(depth < 3);

  const entries = useMemo(() => {
    if (!isObj) return [];
    return isArray
      ? (value as unknown[]).map((v, i) => ({ k: i as string | number, v }))
      : Object.entries(value as object).map(([k, v]) => ({ k, v }));
  }, [value, isObj, isArray]);

  const isEmpty   = isObj && entries.length === 0;
  const indent    = depth * 16;
  const openB     = isArray ? '[' : '{';
  const closeB    = isArray ? ']' : '}';
  const summary   = isArray
    ? `${entries.length} item${entries.length !== 1 ? 's' : ''}`
    : `${entries.length} key${entries.length !== 1 ? 's' : ''}`;

  const KeyLabel = () => nodeKey === undefined ? null : (
    <span className={C.jsonKey}>
      {typeof nodeKey === 'number'
        ? <span className={C.index}>[{nodeKey}]</span>
        : <>{`"${nodeKey}"`}<span className="text-[#8b949e] mx-1">:</span></>}
    </span>
  );

  // ── Primitive ──────────────────────────────────────────────────────────────
  if (!isObj) {
    return (
      <div className="flex items-start leading-6 hover:bg-white/3 rounded-sm px-1 py-0.5 text-[12.5px] font-mono min-w-0">
        <span style={{ width: indent }} className="shrink-0" />
        <KeyLabel />
        <PrimitiveValue value={value} />
        {!isLast && <span className={C.bracket}>,</span>}
      </div>
    );
  }

  // ── Object / Array ─────────────────────────────────────────────────────────
  return (
    <div className="min-w-0">
      <div
        className="flex items-center leading-6 hover:bg-white/3 rounded-sm px-1 py-0.5 text-[12.5px] font-mono cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ width: indent }} className="shrink-0" />
        <span className="mr-1 text-[#8b949e] shrink-0 w-4 flex items-center justify-center">
          {!isEmpty && (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        </span>
        <KeyLabel />
        <span className={C.bracket}>{openB}</span>
        {!open && !isEmpty && <span className="text-[#8b949e] text-[11px] mx-1.5 font-normal">{summary}</span>}
        {(!open || isEmpty) && (
          <>
            <span className={C.bracket}>{closeB}</span>
            {!isLast && <span className={C.bracket}>,</span>}
          </>
        )}
      </div>

      {open && !isEmpty && (
        <div>
          {entries.map(({ k, v }, i) => (
            <JsonNode key={i} nodeKey={k} value={v} depth={depth + 1} isLast={i === entries.length - 1} />
          ))}
          <div className="flex items-center leading-6 font-mono text-[12.5px] px-1">
            <span style={{ width: indent }} className="shrink-0" />
            <span className="w-4 mr-1 shrink-0" />
            <span className={C.bracket}>{closeB}</span>
            {!isLast && <span className={C.bracket}>,</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// XML TREE
// ═════════════════════════════════════════════════════════════════════════════

interface XmlNodeProps {
  node: Element;
  depth: number;
  isLast?: boolean;
}

function XmlNode({ node, depth, isLast = true }: XmlNodeProps) {
  const [open, setOpen] = useState(depth < 3);

  const indent = depth * 16;

  // Separate element children from text / CDATA nodes
  const childElements = useMemo(
    () => Array.from(node.children),
    [node]
  );

  // Text content only when there are NO child elements (pure text node)
  const textContent = useMemo(() => {
    if (childElements.length > 0) return null;
    const t = node.textContent?.trim();
    return t || null;
  }, [node, childElements]);

  const hasChildren = childElements.length > 0;
  const isEmpty     = !hasChildren && !textContent;

  // Parse tag name — split namespace prefix
  const rawName  = node.tagName;
  const colonIdx = rawName.indexOf(':');
  const nsPrefix = colonIdx !== -1 ? rawName.substring(0, colonIdx + 1) : '';
  const localName = colonIdx !== -1 ? rawName.substring(colonIdx + 1) : rawName;

  // Attributes
  const attrs = useMemo(
    () => Array.from(node.attributes).map(a => ({ name: a.name, value: a.value })),
    [node]
  );

  // ── Opening tag component ──────────────────────────────────────────────────
  const OpenTag = ({ closing = false }: { closing?: boolean }) => (
    <>
      <span className={C.xmlPunct}>&lt;</span>
      {closing && <span className={C.xmlPunct}>/</span>}
      {nsPrefix && <span className={C.xmlNs}>{nsPrefix}</span>}
      <span className={C.xmlTag}>{localName}</span>
      {!closing && attrs.map((a, i) => {
        const aColon = a.name.indexOf(':');
        const aNs   = aColon !== -1 ? a.name.substring(0, aColon + 1) : '';
        const aLocal = aColon !== -1 ? a.name.substring(aColon + 1) : a.name;
        return (
          <span key={i} className="ml-1">
            {aNs && <span className={C.xmlNs}>{aNs}</span>}
            <span className={C.xmlAttrKey}>{aLocal}</span>
            <span className={C.xmlPunct}>=&quot;</span>
            <span className={C.xmlAttrVal}>{a.value}</span>
            <span className={C.xmlPunct}>&quot;</span>
          </span>
        );
      })}
      {isEmpty && !closing && <span className={C.xmlPunct}>/</span>}
      <span className={C.xmlPunct}>&gt;</span>
    </>
  );

  // ── Self-closing / text-only leaf ─────────────────────────────────────────
  if (isEmpty) {
    return (
      <div className="flex items-start leading-6 hover:bg-white/3 rounded-sm px-1 py-0.5 text-[12.5px] font-mono min-w-0">
        <span style={{ width: indent }} className="shrink-0" />
        <span className="w-4 mr-1 shrink-0" />
        <OpenTag />
      </div>
    );
  }

  if (!hasChildren && textContent) {
    return (
      <div className="flex items-start leading-6 hover:bg-white/3 rounded-sm px-1 py-0.5 text-[12.5px] font-mono min-w-0 flex-wrap gap-x-0">
        <span style={{ width: indent }} className="shrink-0" />
        <span className="w-4 mr-1 shrink-0" />
        <OpenTag />
        <span className={C.xmlText}>{textContent}</span>
        <OpenTag closing />
      </div>
    );
  }

  // ── Element with child elements ────────────────────────────────────────────
  return (
    <div className="min-w-0">
      {/* Opening row — clickable */}
      <div
        className="flex items-center leading-6 hover:bg-white/3 rounded-sm px-1 py-0.5 text-[12.5px] font-mono cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ width: indent }} className="shrink-0" />
        <span className="mr-1 text-[#8b949e] shrink-0 w-4 flex items-center justify-center">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <OpenTag />
        {!open && (
          <span className="text-[#8b949e] text-[11px] mx-1.5 font-normal">
            {childElements.length} child{childElements.length !== 1 ? 'ren' : ''}
          </span>
        )}
        {!open && <OpenTag closing />}
      </div>

      {/* Children */}
      {open && (
        <div>
          {childElements.map((child, i) => (
            <XmlNode
              key={i}
              node={child}
              depth={depth + 1}
              isLast={i === childElements.length - 1}
            />
          ))}
          {/* Closing tag */}
          <div className="flex items-center leading-6 font-mono text-[12.5px] px-1 hover:bg-white/3 rounded-sm">
            <span style={{ width: indent }} className="shrink-0" />
            <span className="w-4 mr-1 shrink-0" />
            <OpenTag closing />
          </div>
        </div>
      )}
    </div>
  );
}

// Root XML tree (shows all top-level elements, including processing instructions, comments)
function XmlTree({ doc, rawBody }: { doc: Document; rawBody: string }) {
  const root = doc.documentElement;
  if (!root) return <span className="text-[#8b949e] italic text-xs">Empty XML document</span>;

  // Detect XML declaration from raw body
  const hasDecl = rawBody.trimStart().startsWith('<?xml');
  const declLine = hasDecl ? rawBody.trimStart().match(/<\?xml[^?]*\?>/)?.[0] : null;

  return (
    <div className="p-2">
      {declLine && (
        <div className="text-[12.5px] font-mono px-1 py-0.5 text-[#6e7681] italic select-none">
          {declLine}
        </div>
      )}
      <XmlNode node={root} depth={0} isLast={true} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Detection helpers
// ═════════════════════════════════════════════════════════════════════════════

function detectFormat(body: string): 'json' | 'xml' | 'text' {
  const t = body?.trim() ?? '';
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith('<'))                        return 'xml';
  return 'text';
}

function tryParseJson(body: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try   { return { ok: true, data: JSON.parse(body.trim()) }; }
  catch (e: any) { return { ok: false, error: e.message }; }
}

function tryParseXml(body: string): { ok: true; doc: Document } | { ok: false; error: string } {
  try {
    const parser = new DOMParser();
    const doc    = parser.parseFromString(body.trim(), 'text/xml');
    const err    = doc.querySelector('parsererror');
    if (err) return { ok: false, error: err.textContent ?? 'XML parse error' };
    return { ok: true, doc };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Main viewer
// ═════════════════════════════════════════════════════════════════════════════

interface RecorderBodyViewerProps {
  /** The raw recorded body string from the RESPONSE_PROCESSOR step */
  body: string;
  /** Max height in px of the scrollable container (default 440) */
  maxHeight?: number;
}

export const RecorderBodyViewer: React.FC<RecorderBodyViewerProps> = ({
  body,
  maxHeight = 440,
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied]     = useState(false);

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [body]);

  const format = useMemo(() => detectFormat(body), [body]);

  const jsonResult = useMemo(
    () => format === 'json' ? tryParseJson(body) : null,
    [body, format]
  );

  const xmlResult = useMemo(
    () => format === 'xml' ? tryParseXml(body) : null,
    [body, format]
  );

  const canTree = (format === 'json' && jsonResult?.ok) || (format === 'xml' && xmlResult?.ok);

  const formatLabel = format === 'json' ? 'JSON' : format === 'xml' ? 'XML / SOAP' : 'Plain Text';
  const formatColor = format === 'json' ? 'text-[#7ee787]' : format === 'xml' ? 'text-[#79c0ff]' : 'text-[#8b949e]';

  if (!body) {
    return (
      <div className="p-6 text-center text-xs text-[#8b949e] italic bg-[#0d1117] rounded-xl border border-[#21262d]">
        No recorded output
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#21262d] bg-[#0d1117] shadow-2xl overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d] bg-[#161b22]">
        <div className="flex items-center gap-2">
          {/* Format badge */}
          <span className={`text-[10px] font-bold ${formatColor} bg-[#21262d] rounded px-2 py-0.5`}>
            {formatLabel}
          </span>

          {/* Tree / Raw toggle */}
          {canTree && (
            <div className="flex items-center bg-[#0d1117] rounded border border-[#21262d] overflow-hidden">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === 'tree' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                Tree
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                  viewMode === 'raw' ? 'bg-[#21262d] text-[#c9d1d9]' : 'text-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                Raw
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#8b949e] font-mono">
            {body.length.toLocaleString()} chars
          </span>
          <button
            onClick={copyAll}
            title="Copy raw content"
            className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-[#c9d1d9] transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="overflow-auto scrollbar-thin" style={{ maxHeight }}>

        {/* JSON tree */}
        {format === 'json' && jsonResult?.ok && viewMode === 'tree' && (
          <div className="p-2">
            <JsonNode value={jsonResult.data} depth={0} isLast={true} />
          </div>
        )}

        {/* XML tree */}
        {format === 'xml' && xmlResult?.ok && viewMode === 'tree' && (
          <XmlTree doc={xmlResult.doc} rawBody={body} />
        )}

        {/* Parse error notice */}
        {viewMode === 'tree' && format === 'json' && jsonResult && !jsonResult.ok && (
          <div className="p-3 text-[11px] text-rose-400 bg-rose-500/5 border-b border-rose-500/20">
            ⚠ JSON parse error: {(jsonResult as any).error} — showing raw text below.
          </div>
        )}
        {viewMode === 'tree' && format === 'xml' && xmlResult && !xmlResult.ok && (
          <div className="p-3 text-[11px] text-rose-400 bg-rose-500/5 border-b border-rose-500/20">
            ⚠ XML parse error: {(xmlResult as any).error} — showing raw text below.
          </div>
        )}

        {/* Raw / text fallback — always shown for text format, or raw mode */}
        {(viewMode === 'raw' || format === 'text'
          || (format === 'json' && jsonResult && !jsonResult.ok)
          || (format === 'xml'  && xmlResult  && !xmlResult.ok)) && (
          <pre className="p-4 text-[#c9d1d9] text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap break-words">
            {body}
          </pre>
        )}
      </div>
    </div>
  );
};

export default RecorderBodyViewer;
