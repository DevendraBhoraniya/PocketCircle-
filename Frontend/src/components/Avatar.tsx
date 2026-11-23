import { useMemo, useState } from 'react';

const COLORS = [
  'bg-electric-blue text-white',
  'bg-midnight text-white',
  'bg-ember-orange text-white',
  'bg-parchment text-ink-black border border-sand',
  'bg-graphite text-white'
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
    if (!name) return 'bg-steel text-white';
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
        loading="lazy"
        decoding="async"
        className={`${sizeClasses[size]} shrink-0 rounded-full border border-sand object-cover bg-paper-white ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} shrink-0 rounded-full flex items-center justify-center font-medium select-none ${className}`}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
}
