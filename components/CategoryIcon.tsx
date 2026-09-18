import {
  Landmark, TrendingUp, Trophy, Cpu, Globe2, Clapperboard, CloudSun, Tag,
  type LucideProps,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  politics: Landmark,
  economy: TrendingUp,
  sports: Trophy,
  tech: Cpu,
  world: Globe2,
  entertainment: Clapperboard,
  weather: CloudSun,
};

interface Props extends LucideProps {
  category: string;
}

/** Kategori ikonu — tek ikon ailesi (Lucide), sabit 1.75 stroke. */
export function CategoryIcon({ category, size = 14, strokeWidth = 1.75, ...rest }: Props) {
  const Icon = ICONS[category] ?? Tag;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}
