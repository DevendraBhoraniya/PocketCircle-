import { useMemo, useState } from 'react';

const COLORS = [
  'bg-riot-pink', 'bg-voltage-cyan', 'bg-toxic-lime', 'bg-sticker-khaki'
];

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Avatar({ name, url, size = 'md' }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const sizeClasses = {
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

  const bgColor = useMemo(() => {
    if (!name) return 'bg-placeholder-ash';
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
        className={`${sizeClasses[size]} rounded-full border border-black object-cover bg-card-white`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${bgColor} rounded-full border border-black text-black flex items-center justify-center font-bold select-none`}>
      {initials}
    </div>
  );
}
