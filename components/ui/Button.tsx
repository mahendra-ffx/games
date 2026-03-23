import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-ct-blue text-white hover:bg-opacity-90 focus-visible:ring-2 focus-visible:ring-ct-blue",
  secondary: "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]",
  ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", isLoading, disabled, children, className = "", ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          "type-button inline-flex items-center justify-center gap-2 rounded-md transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        ].join(" ")}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
            <path
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
