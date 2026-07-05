import React, { InputHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

// ── BUTTON ──────────────────────────────────────────────────────────────────
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20": variant === 'primary',
            "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === 'secondary',
            "border border-border bg-background hover:bg-accent hover:text-accent-foreground": variant === 'outline',
            "hover:bg-accent hover:text-accent-foreground": variant === 'ghost',
            "bg-destructive text-destructive-foreground hover:bg-destructive/90": variant === 'destructive',
            "bg-cyan-500 hover:bg-cyan-600 text-black shadow-md shadow-cyan-500/20": variant === 'accent',
          },
          {
            "h-8 px-3 text-xs": size === 'sm',
            "h-10 px-4 py-2 text-sm": size === 'md',
            "h-12 px-6 text-base": size === 'lg',
            "h-10 w-10 p-0": size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

// ── INPUT ───────────────────────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

// ── TEXTAREA ────────────────────────────────────────────────────────────────
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// ── SELECT ──────────────────────────────────────────────────────────────────
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-background text-foreground">
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';

// ── SWITCH ──────────────────────────────────────────────────────────────────
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="inline-flex items-center space-x-2 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            ref={ref}
            className="sr-only peer"
            {...props}
          />
          <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </div>
        {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      </label>
    );
  }
);
Switch.displayName = 'Switch';

// ── CARD ────────────────────────────────────────────────────────────────────
export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
);
export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
);
export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
);
export const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);
export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
);
export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
);

// ── BADGE ───────────────────────────────────────────────────────────────────
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "border-transparent bg-primary text-primary-foreground": variant === 'default',
          "border-transparent bg-secondary text-secondary-foreground": variant === 'secondary',
          "border-transparent bg-destructive text-destructive-foreground": variant === 'destructive',
          "border-transparent bg-emerald-500/20 text-emerald-400 border border-emerald-500/30": variant === 'success',
          "border-transparent bg-amber-500/20 text-amber-400 border border-amber-500/30": variant === 'warning',
          "text-foreground border-border": variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
};

// ── TABS ────────────────────────────────────────────────────────────────────
interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}
export const TabsContext = React.createContext<{ activeTab: string; setActiveTab: (value: string) => void }>({
  activeTab: '',
  setActiveTab: () => {},
});

export const Tabs: React.FC<TabsProps> = ({ defaultValue, value, onValueChange, children, className, ...props }) => {
  const [localActiveTab, setLocalActiveTab] = React.useState(defaultValue || '');
  
  const activeTab = value !== undefined ? value : localActiveTab;
  const setActiveTab = React.useCallback((val: string) => {
    if (value === undefined) {
      setLocalActiveTab(val);
    }
    if (onValueChange) {
      onValueChange(val);
    }
  }, [value, onValueChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}
export const TabsList: React.FC<TabsListProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-secondary p-1 text-muted-foreground", className)} {...props}>
      {children}
    </div>
  );
};

interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
}
export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className, onClick, ...props }) => {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(value);
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}
export const TabsContent: React.FC<TabsContentProps> = ({ value, children, className, ...props }) => {
  const { activeTab } = React.useContext(TabsContext);
  if (activeTab !== value) return null;
  return (
    <div className={cn("mt-2 ring-offset-background focus-visible:outline-none", className)} {...props}>
      {children}
    </div>
  );
};

// ── DIALOG / MODAL ──────────────────────────────────────────────────────────
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children, className, size = 'lg' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      {/* Dialog box */}
      <div className={cn(
        "relative bg-card border border-border text-card-foreground rounded-lg shadow-xl w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200",
        sizeClasses[size],
        className
      )}>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6 border-b border-border/40", className)} {...props} />
);

export const DialogTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
);

export const DialogFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex items-center justify-end space-x-2 p-6 border-t border-border/40 bg-secondary/20", className)} {...props} />
);

