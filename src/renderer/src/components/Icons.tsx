import type { SVGProps } from 'react'

/** Line icons in the spirit of SF Symbols (16pt, regular weight). */
type P = SVGProps<SVGSVGElement> & { size?: number }

function Icon({
  size = 16,
  children,
  ...rest
}: P & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const SidebarIcon = (p: P) => (
  <Icon {...p}>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" />
    <path d="M6 2.75v10.5M3.5 5.25h1M3.5 7.25h1" />
  </Icon>
)
export const PlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
)
export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3 3" />
  </Icon>
)
export const CalendarIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" />
    <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" />
  </Icon>
)
export const StarIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="m8 1.9 1.85 3.85 4.2.55-3.07 2.92.78 4.17L8 11.37l-3.76 2.02.78-4.17L1.95 6.3l4.2-.55z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
)
export const TagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2.25 2.25h5.2l6.3 6.3-5.2 5.2-6.3-6.3z" />
    <circle cx="5.25" cy="5.25" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
)
export const TrashIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2.75 4.25h10.5M6.25 4.25V2.75h3.5v1.5M4 4.25l.65 8.6c.05.7.62 1.15 1.3 1.15h4.1c.68 0 1.25-.45 1.3-1.15L12 4.25" />
  </Icon>
)
export const DocIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4.25 1.75h4.75l3 3v8.5c0 .55-.45 1-1 1h-6.75c-.55 0-1-.45-1-1V2.75c0-.55.45-1 1-1z" />
    <path d="M8.75 1.75v3.25h3.25" />
  </Icon>
)
export const FolderIcon = (p: P) => (
  <Icon {...p}>
    <path d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h3l1.5 1.5h5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5z" />
  </Icon>
)
export const FolderPlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M1.75 4.25c0-.83.67-1.5 1.5-1.5h3l1.5 1.5h5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-9.5c-.83 0-1.5-.67-1.5-1.5z" />
    <path d="M8 7v4M6 9h4" />
  </Icon>
)
export const GearIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.75v1.6M8 12.65v1.6M14.25 8h-1.6M3.35 8h-1.6M12.42 3.58l-1.13 1.13M4.71 11.29l-1.13 1.13M12.42 12.42l-1.13-1.13M4.71 4.71 3.58 3.58" />
    <circle cx="8" cy="8" r="4.6" />
  </Icon>
)
export const ChevronIcon = (p: P) => (
  <Icon size={10} viewBox="0 0 10 10" strokeWidth={1.5} {...p}>
    <path d="m3.5 2 3 3-3 3" />
  </Icon>
)
export const ChevronDownIcon = (p: P) => (
  <Icon {...p}>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
  </Icon>
)
export const ClockIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </Icon>
)
export const InfoIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.25v3.75M8 5v.01" />
  </Icon>
)
export const WarningIcon = (p: P) => (
  <Icon {...p}>
    <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5z" />
    <path d="M8 6.25v3M8 11.25v.01" />
  </Icon>
)
export const ArrowLeftIcon = (p: P) => (
  <Icon {...p}>
    <path d="m9.5 3.5-4.5 4.5 4.5 4.5" />
  </Icon>
)
export const ArrowRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="m6.5 3.5 4.5 4.5-4.5 4.5" />
  </Icon>
)
export const CommandIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6h4v4H6zM6 6V4.5A1.5 1.5 0 1 0 4.5 6zM10 6h1.5A1.5 1.5 0 1 0 10 4.5zM10 10v1.5a1.5 1.5 0 1 0 1.5-1.5zM6 10H4.5A1.5 1.5 0 1 0 6 11.5z" />
  </Icon>
)
export const VaultIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="M2 6h12" />
  </Icon>
)
export const MoreIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="3.75" cy="8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12.25" cy="8" r=".9" fill="currentColor" stroke="none" />
  </Icon>
)
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
)
export const PenIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10.75 2.75 13.25 5.25 6 12.5l-3.25.75.75-3.25z" />
  </Icon>
)
export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </Icon>
)
export const OutlineIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 4h10M5.5 8H13M8 12h5" />
  </Icon>
)
export const ChevronUpIcon = (p: P) => (
  <Icon {...p}>
    <path d="m4 10 4-4 4 4" />
  </Icon>
)
export const SmileIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M5.9 9.4c.5.8 1.2 1.2 2.1 1.2s1.6-.4 2.1-1.2" />
    <path d="M6 6.4v.2M10 6.4v.2" />
  </Icon>
)
export const CalloutIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2" y="3" width="12" height="10" rx="2" />
    <path d="M5 3v10" />
    <path d="M7.5 6.5h4M7.5 9.5h3" />
  </Icon>
)
/** A sun with two planets on their orbits. */
export const GraphIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="2" />
    <ellipse cx="8" cy="8" rx="6.25" ry="3.25" transform="rotate(-25 8 8)" />
    <circle cx="13.4" cy="5.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="3.1" cy="10.9" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
)
export const DiagramIcon = (p: P) => (
  <Icon {...p}>
    <rect x="5.5" y="1.75" width="5" height="3.5" rx="1" />
    <rect x="1.75" y="10.75" width="5" height="3.5" rx="1" />
    <rect x="9.25" y="10.75" width="5" height="3.5" rx="1" />
    <path d="M8 5.25V8M4.25 10.75V8h7.5v2.75" />
  </Icon>
)
export const HighlighterIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9.75 2.75 13.25 6.25 8 11.5H4.5V8z" />
    <path d="M4.5 11.5 3 13h3.5" />
    <path d="M2.5 14.75h11" strokeWidth={2} stroke="var(--mark-solid, #ffcc00)" />
  </Icon>
)
