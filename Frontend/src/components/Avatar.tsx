import { useMemo, useState } from 'react';

const COLORS = [
  'bg-riot-pink text-black',
  'bg-voltage-cyan text-black',
  'bg-toxic-lime text-black',
  'bg-sticker-khaki text-black'
];

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Avatar({ name, url, size = 'md', className = '' }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl',
  };

  const initials = useMemo(() => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const colorClass = useMemo(() => {
    if (!name) return 'bg-placeholder-ash text-white';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLORS.length;
    return COLORS[index];
  }, [name]);

  if (url && !imageFailed) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClasses[size]} shrink-0 rounded-full border border-black object-cover bg-card-white shadow-[1px_1px_0_#000] ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} shrink-0 rounded-full border border-black flex items-center justify-center font-bold tracking-tight select-none shadow-[1px_1px_0_#000] ${className}`}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}
