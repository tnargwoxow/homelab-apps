import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function CabinIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...props}>
      <path d="M4 16 L16 6 L28 16" />
      <path d="M7 14 V26 H25 V14" />
      <rect x="13" y="18" width="6" height="8" />
      <path d="M22 9 V13" />
      <path d="M22 5 C22 7 23 7 23 8" />
    </svg>
  );
}

export function PineIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 L7 10 H9 L5 16 H9 L4 22 H20 L15 16 H19 L15 10 H17 Z" />
      <rect x="11" y="22" width="2" height="2" />
    </svg>
  );
}

export function FireIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 C13 6 17 7 17 12 C17 15.3 14.8 18 12 18 C9.2 18 7 15.3 7 12 C7 10 8 9 9 8 C9 10 10 10.5 11 10.5 C12 10.5 12.5 9 11.8 7 C11 5 11 3.5 12 2 Z" />
      <path d="M9 17 H15 V20 H9 Z" opacity="0.5" />
    </svg>
  );
}

export function PotIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M5 12 H27" />
      <path d="M7 12 L8 26 H24 L25 12" />
      <path d="M3 12 H5 M27 12 H29" />
      <path d="M12 6 C12 8 14 8 14 10 M18 6 C18 8 20 8 20 10" opacity="0.7" />
    </svg>
  );
}

export function SnowflakeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...props}>
      <path d="M12 2 V22 M2 12 H22 M5 5 L19 19 M19 5 L5 19" />
    </svg>
  );
}

export function FishIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" {...props}>
      <path d="M3 16 C7 9 14 7 20 9 L28 4 L26 12 L28 20 L20 23 C14 25 7 23 3 16 Z" />
      <circle cx="22" cy="14" r="1.2" fill="#f5ebd9" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 4 C12 4 4 10 4 20 C14 20 20 12 20 4 Z" />
      <path d="M4 20 L18 6" stroke="#f5ebd9" strokeWidth="0.6" fill="none" />
    </svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M4 6 H20 M4 12 H20 M4 18 H20" />
      <circle cx="4" cy="6" r="0.6" fill="currentColor" />
      <circle cx="4" cy="12" r="0.6" fill="currentColor" />
      <circle cx="4" cy="18" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps & { dir?: 'left' | 'right' }) {
  const { dir = 'right', ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {dir === 'right' ? <path d="M9 6 L15 12 L9 18" /> : <path d="M15 6 L9 12 L15 18" />}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M5 5 L19 19 M19 5 L5 19" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
    </svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7 H7 L17 17 H21" />
      <path d="M3 17 H7 L9 15" />
      <path d="M15 9 L17 7 H21" />
      <path d="M18 4 L21 7 L18 10" />
      <path d="M18 14 L21 17 L18 20" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 V12 L15 14" strokeLinecap="round" />
    </svg>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 9 V4 H17 V9" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <rect x="7" y="14" width="10" height="6" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8 V6 a2 2 0 0 0 -2 -2 H6 a2 2 0 0 0 -2 2 v8 a2 2 0 0 0 2 2 h2" />
    </svg>
  );
}
