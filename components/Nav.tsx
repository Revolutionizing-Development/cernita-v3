import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { href: '/',        icon: '◎', label: 'Evaluate' },
  { href: '/log',     icon: '☰', label: 'Log' },
  { href: '/bins',    icon: '⊞', label: 'Bins' },
  { href: '/discuss', icon: '◇', label: 'Discuss' },
  { href: '/settings',icon: '⚙', label: 'Settings' },
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
