import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { href: '/dashboard',  icon: '◈', label: 'Overview' },
  { href: '/evaluate',   icon: '◎', label: 'Evaluate' },
  { href: '/log',        icon: '☰', label: 'Log' },
  { href: '/bins',       icon: '⊞', label: 'Bins' },
  { href: '/trips',      icon: '✈', label: 'Trips' },
  { href: '/settings',   icon: '⚙', label: 'Settings' },
]

export default function Nav() {
  const router = useRouter()
  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`nav-item ${router.pathname === tab.href ? 'active' : ''}`}
        >
          <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
