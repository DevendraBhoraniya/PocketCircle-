import type { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base rectangular or shaped block placeholder with shimmer animation
 */
export function SkeletonBlock({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`pc-skeleton-shimmer rounded-xl ${className}`}
      {...props}
    />
  );
}

/**
 * Text line skeleton simulating natural typography
 */
export interface SkeletonTextProps extends SkeletonProps {
  lines?: number;
  height?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 1,
  height = "h-4",
  lastLineWidth = "w-3/4",
  className = "",
  ...props
}: SkeletonTextProps) {
  if (lines <= 1) {
    return (
      <SkeletonBlock
        className={`w-full ${height} rounded-md ${className}`}
        {...props}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true" {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-4 rounded-md ${
            i === lines - 1 ? lastLineWidth : "w-full"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Circular avatar placeholder matching Avatar sizes
 */
export interface SkeletonAvatarProps extends SkeletonProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const AVATAR_SIZES: Record<NonNullable<SkeletonAvatarProps["size"]>, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export function SkeletonAvatar({
  size = "md",
  className = "",
  ...props
}: SkeletonAvatarProps) {
  const sizeClass = AVATAR_SIZES[size] || AVATAR_SIZES.md;
  return (
    <SkeletonBlock
      className={`shrink-0 rounded-full ${sizeClass} ${className}`}
      {...props}
    />
  );
}

/**
 * Pill badge placeholder
 */
export function SkeletonBadge({ className = "", ...props }: SkeletonProps) {
  return (
    <SkeletonBlock
      className={`h-6 w-24 rounded-full ${className}`}
      {...props}
    />
  );
}

/**
 * Pill button placeholder matching .pc-btn
 */
export function SkeletonButton({ className = "", ...props }: SkeletonProps) {
  return (
    <SkeletonBlock
      className={`h-10 w-28 rounded-full ${className}`}
      {...props}
    />
  );
}
