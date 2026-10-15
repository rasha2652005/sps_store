import {
  BatteryCharging,
  Cable,
  Camera,
  Car,
  Gamepad2,
  Gift,
  Headphones,
  Laptop,
  Package,
  Plug,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Speaker,
  Tablet,
  Tag,
  Watch,
  Zap,
} from 'lucide-react';

/** Phone case icon (lucide has none). */
export function CaseIcon({ className, strokeWidth = 2, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <rect x="5" y="2" width="14" height="20" rx="3.5" />
      <rect x="7.5" y="4.5" width="5" height="5" rx="1.5" />
      <path d="M19 9v3" />
    </svg>
  );
}

export const CATEGORY_ICONS = {
  smartphone: Smartphone,
  tablet: Tablet,
  headphones: Headphones,
  watch: Watch,
  zap: Zap,
  cable: Cable,
  'battery-charging': BatteryCharging,
  'smartphone-case': CaseIcon,
  'shield-check': ShieldCheck,
  car: Car,
  package: Package,
  gamepad: Gamepad2,
  laptop: Laptop,
  speaker: Speaker,
  camera: Camera,
  plug: Plug,
  gift: Gift,
  sparkles: Sparkles,
  tag: Tag,
};

export const categoryIcon = (name) => CATEGORY_ICONS[name] || Package;
