import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  X, 
  ImageIcon,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

interface ScreenshotItem {
  name: string;
  filename: string;
  path?: string;
}

interface ScreenshotViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: ScreenshotItem[];
  initialFilename: string;
  execId: string;
  stepId: string;
  stepName: string;
}

const SecureImageContent: React.FC<{ src: string; alt: string; className?: string; style?: React.CSSProperties }> = ({ src, alt, className, style }) => {
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      try {
        setLoading(true);
        const response = await api.get(src, { responseType: 'blob' });
        if (active) {
          const url = URL.createObjectURL(response.data);
          setObjectUrl(url);
          setError(false);
        }
      } catch (err) {
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div className="w-96 h-64 bg-secondary/10 flex items-center justify-center text-xs text-muted-foreground animate-pulse rounded-lg border border-border/30">
        Loading image...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-96 h-64 bg-rose-500/10 flex flex-col items-center justify-center text-xs text-rose-400 rounded-lg border border-rose-500/30 p-4">
        Failed to load screenshot image
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} style={style} draggable={false} />;
};

export const ScreenshotViewerModal: React.FC<ScreenshotViewerModalProps> = ({
  isOpen,
  onClose,
  screenshots,
  initialFilename,
  execId,
  stepId,
  stepName
}) => {
  const initialIndex = Math.max(0, screenshots.findIndex(s => s.filename === initialFilename));
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex >= 0 ? initialIndex : 0);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFitScreen, setIsFitScreen] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentScreenshot = screenshots[currentIndex] || { name: 'Screenshot', filename: initialFilename };
  const currentImgSrc = `/executions/${execId}/steps/${stepId}/screenshots/${currentScreenshot.filename}`;

  // Reset zoom & pan when switching screenshots
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsFitScreen(true);
  }, [currentIndex]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3.5));
    setIsFitScreen(false);
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
    setIsFitScreen(false);
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsFitScreen(true);
  }, []);

  const toggleFitScreen = useCallback(() => {
    if (isFitScreen) {
      setZoom(1.5);
      setIsFitScreen(false);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsFitScreen(true);
    }
  }, [isFitScreen]);

  const handlePrev = useCallback(() => {
    if (screenshots.length <= 1) return;
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : screenshots.length - 1));
  }, [screenshots.length]);

  const handleNext = useCallback(() => {
    if (screenshots.length <= 1) return;
    setCurrentIndex(prev => (prev < screenshots.length - 1 ? prev + 1 : 0));
  }, [screenshots.length]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Mouse Drag / Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Download screenshot handler
  const handleDownload = async () => {
    try {
      const response = await api.get(currentImgSrc, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', currentScreenshot.filename || 'screenshot.png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Screenshot downloaded');
    } catch (err: any) {
      toast.error('Failed to download screenshot: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(currentScreenshot.filename);
    setCopied(true);
    toast.success('Filename copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="h-14 px-6 border-b border-white/10 bg-black/40 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold text-white truncate max-w-sm">
                {currentScreenshot.name || 'Screenshot'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70 border border-white/10">
                {currentIndex + 1} of {screenshots.length}
              </span>
            </div>
            <p className="text-[10px] text-white/50 truncate font-mono mt-0.5">
              Step: {stepName} • {currentScreenshot.filename}
            </p>
          </div>
        </div>

        {/* Center Zoom Controls Toolbar */}
        <div className="flex items-center space-x-1.5 bg-white/10 p-1 rounded-xl border border-white/15 backdrop-blur-lg">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-extrabold text-white/90 hover:text-white hover:bg-white/15 transition-all cursor-pointer flex items-center gap-1"
            title="Reset Zoom (0)"
          >
            <span>{Math.round(zoom * 100)}%</span>
            {zoom !== 1 && <RotateCcw className="h-3 w-3 text-cyan-400" />}
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3.5}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-white/20 my-auto mx-0.5" />

          <button
            type="button"
            onClick={toggleFitScreen}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${isFitScreen ? 'text-cyan-400 bg-white/15' : 'text-white/80 hover:text-white hover:bg-white/15'}`}
            title={isFitScreen ? 'Actual Size' : 'Fit to Screen'}
          >
            {isFitScreen ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Right Actions & Close */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopyFilename}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Copy Filename"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md cursor-pointer"
            title="Download Screenshot"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-rose-500/20 hover:text-rose-300 transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Next / Prev Floating Arrow Controls */}
        {screenshots.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Previous Screenshot (Left Arrow)"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
              title="Next Screenshot (Right Arrow)"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Scaled & Panned Image Container */}
        <div 
          className="transition-transform duration-75 ease-out max-w-full max-h-full flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
        >
          <SecureImageContent 
            src={currentImgSrc} 
            alt={currentScreenshot.name || 'Screenshot'} 
            className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg border border-white/20 shadow-2xl transition-all"
          />
        </div>
      </div>

      {/* Bottom Thumbnail Strip Carousel */}
      {screenshots.length > 1 && (
        <div className="h-20 border-t border-white/10 bg-black/50 p-2 flex items-center justify-center shrink-0 z-20">
          <div className="flex items-center space-x-3 overflow-x-auto max-w-3xl scrollbar-thin px-4">
            {screenshots.map((s, idx) => {
              const isSelected = idx === currentIndex;
              const thumbSrc = `/executions/${execId}/steps/${stepId}/screenshots/${s.filename}`;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-14 w-24 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 relative group ${
                    isSelected ? 'border-primary ring-2 ring-primary/40 scale-105' : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/40'
                  }`}
                >
                  <SecureImageContent 
                    src={thumbSrc} 
                    alt={s.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 p-0.5 text-[9px] font-semibold text-white truncate text-center">
                    {s.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
