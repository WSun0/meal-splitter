import { personColor } from '@/lib/utils/person-color';

const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
} as const;

export default function PersonAvatar({
  name,
  index,
  size = 'md',
}: {
  name: string;
  index: number;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`${SIZES[size]} shrink-0 rounded-full inline-flex items-center justify-center font-semibold text-white select-none`}
      style={{ backgroundColor: personColor(index) }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
