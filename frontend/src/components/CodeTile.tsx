import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Tile } from './Tile';

interface CodeTileProps {
  title?: string;
  code: string | object;
  colSpan?: number | string;
  rowSpan?: number | string;
  className?: string;
  maxHeight?: string;
}

export const CodeTile: React.FC<CodeTileProps> = ({
  title = 'Raw Telemetry JSON',
  code,
  colSpan = 6,
  rowSpan = 2,
  className = '',
  maxHeight = '240px',
}) => {
  const [copied, setCopied] = useState(false);
  const formattedCode = typeof code === 'string' ? code : JSON.stringify(code, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tile
      variant="ink"
      colSpan={colSpan}
      rowSpan={rowSpan}
      title={title}
      action={
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-onDeep/70 hover:text-onDeep bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-pill transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-green" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      }
      className={className}
      padding="dense"
    >
      <div
        className="font-mono text-xs text-onDeep/90 overflow-auto bg-black/30 p-3 rounded-inner border border-white/5"
        style={{ maxHeight }}
      >
        <pre className="whitespace-pre font-mono leading-relaxed">{formattedCode}</pre>
      </div>
    </Tile>
  );
};
