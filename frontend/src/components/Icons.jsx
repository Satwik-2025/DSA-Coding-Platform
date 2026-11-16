// Small stroke icon set (24px grid, 1.6 stroke) drawn inline so no icon library is needed.
function Icon({ children, size = 18, className = '', ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 ${className}`} {...rest}>
      {children}
    </svg>
  )
}

export const IconToday = (p) => (
  <Icon {...p}><path d="M4 13.5 12 5l8 8.5" /><path d="M6.5 11v8h11v-8" /><path d="M10 19v-4.5h4V19" /></Icon>
)
export const IconMap = (p) => (
  <Icon {...p}><circle cx="5.5" cy="6" r="2.2" /><circle cx="18.5" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M7.6 6h8.8M6.7 7.9l4.1 8.2M17.3 7.9l-4.1 8.2" /></Icon>
)
export const IconCode = (p) => (
  <Icon {...p}><path d="m8.5 8-4 4 4 4" /><path d="m15.5 8 4 4-4 4" /><path d="m13.5 5-3 14" /></Icon>
)
export const IconGauge = (p) => (
  <Icon {...p}><path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="m12 13 3.5-4" /><circle cx="12" cy="13" r="1.2" /></Icon>
)
export const IconAlert = (p) => (
  <Icon {...p}><path d="M12 4 3 19.5h18L12 4Z" /><path d="M12 10v4.5" /><path d="M12 17.2v.1" /></Icon>
)
export const IconSun = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="3.8" /><path d="M12 2.8v2M12 19.2v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.8 12h2M19.2 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></Icon>
)
export const IconMoon = (p) => (
  <Icon {...p}><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" /></Icon>
)
export const IconChevronDown = (p) => <Icon {...p}><path d="m6.5 9.5 5.5 5.5 5.5-5.5" /></Icon>
export const IconChevronRight = (p) => <Icon {...p}><path d="m9.5 6 6 6-6 6" /></Icon>
export const IconArrowRight = (p) => <Icon {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>
export const IconCheck = (p) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
export const IconMenu = (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h10" /></Icon>
export const IconClose = (p) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18" /></Icon>
export const IconSidebar = (p) => (
  <Icon {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /></Icon>
)
export const IconExternal = (p) => (
  <Icon {...p}><path d="M14 4.5h5.5V10" /><path d="m19.5 4.5-8 8" /><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" /></Icon>
)
export const IconRefresh = (p) => (
  <Icon {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></Icon>
)
export const IconUser = (p) => (
  <Icon {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" /></Icon>
)
export const IconSpark = (p) => (
  <Icon {...p}><path d="M12 3.5c.6 4.4 2.6 6.6 7 7.5-4.4.9-6.4 3.1-7 7.5-.6-4.4-2.6-6.6-7-7.5 4.4-.9 6.4-3.1 7-7.5Z" /></Icon>
)
export const IconPlay = (p) => <Icon {...p}><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></Icon>
export const IconLock = (p) => (
  <Icon {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Icon>
)
export const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></Icon>
export const IconTarget = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" /></Icon>
)
export const IconFilter =(p) => <Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>
export const IconBook = (p) => (
  <Icon {...p}><path d="M4.5 5.5A1.5 1.5 0 0 1 6 4h13.5v14H6a1.5 1.5 0 0 0-1.5 1.5v-14Z" /><path d="M4.5 19.5A1.5 1.5 0 0 0 6 21h13.5v-3" /></Icon>
)
