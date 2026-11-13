import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'
import PublicLandingPage from './PublicLandingPage'
import CustomerWorkspace from './CustomerWorkspace'
import { useAuth } from './context/AuthContext'
import CollectionsPage from './CollectionsPage'
import PSPWorkspace from './PSPWorkspace'
import RecyclerWorkspace from './RecyclerWorkspace'
import HealthcareWorkspace from './HealthcareWorkspace'
import PSPOperatorsPage from './PSPOperatorsPage'
import ManagementPages from './ManagementPages'
import {
  LayoutDashboard, Truck, Users, Recycle, Coins, ShieldCheck,
  Building2, Settings, Bell, Search, ArrowUpRight,
  Menu, Leaf, MapPin, Clock3, CheckCircle2, AlertCircle,
  Activity, ChevronDown
} from 'lucide-react'
import './App.css'
import oversightHeroImage from './assets/binops-oversight-hero.png'

const customerNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Collection Requests', icon: Recycle },
  { label: 'Payments & Renewal', icon: Coins },
  { label: 'History & Receipts', icon: Clock3 },
  { label: 'Waste Impact', icon: Leaf },
  { label: 'My Health Credits', icon: Coins },
  { label: 'Healthcare Partners', icon: Building2 },
  { label: 'My PSP', icon: Truck },
  { label: 'Recyclers', icon: Recycle },
  { label: 'My Account', icon: Users },
]

const pspNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Collections', icon: Recycle },
]

const recyclerNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Incoming Handovers', icon: Recycle },
]

const healthcareNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Health Credit Redemptions', icon: Coins },
]

const oversightNavigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Collections', icon: Recycle },
  { label: 'PSP Operators', icon: Truck },
  { label: 'Customers', icon: Users },
  { label: 'Health Credits', icon: Coins },
  { label: 'Blockchain Proofs', icon: ShieldCheck },
  { label: 'Organisations', icon: Building2 },
]

const collections = [
  { id: 'COL-2026-081', customer: 'Greenfield Apartments', area: 'Ikeja', psp: 'CleanCity Services', status: 'Verified', time: '09:42 AM' },
  { id: 'COL-2026-080', customer: 'Adeola Family', area: 'Lekki', psp: 'EcoWaste Lagos', status: 'Collected', time: '09:18 AM' },
  { id: 'COL-2026-079', customer: 'Market Square Ltd', area: 'Yaba', psp: 'CleanCity Services', status: 'In progress', time: '08:55 AM' },
  { id: 'COL-2026-078', customer: 'Sunrise Pharmacy', area: 'Ikeja', psp: 'GreenPath Waste', status: 'Pending', time: '08:30 AM' },
]

function App() {
  const { user, loading, logout } = useAuth()
  const [active, setActive] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register" | "">("")
  const [showWorkspace, setShowWorkspace] = useState(false)

  useEffect(() => {
    if (user) {
      setAuthMode("")
      setShowWorkspace(true)
    }
  }, [user])

  const handleLogout = () => {
    setShowWorkspace(false)
    setAuthMode("")
    logout()
  }

  const organisationType = user?.organisations?.[0]?.type
  const navigation =
    organisationType === 'lawma_authority'
      ? oversightNavigation
      : organisationType === 'psp_operator'
        ? pspNavigation
        : organisationType === 'recycling_facility'
          ? recyclerNavigation
          : ['hospital', 'pharmacy'].includes(organisationType || '')
            ? healthcareNavigation
            : customerNavigation

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'BO'

  if (loading) {
    return <div className="app-loading">Loading BinOps...</div>
  }

  if (authMode) {
    return (
      <LoginPage
        initialMode={authMode}
        onBack={() => setAuthMode("")}
      />
    )
  }

  if (!showWorkspace || !user) {
    return (
      <PublicLandingPage
        isAuthenticated={!!user}
        onLogin={() => {
          if (user) setShowWorkspace(true)
          else setAuthMode("login")
        }}
        onRegister={() => setAuthMode("register")}
        onWorkspace={() => setShowWorkspace(true)}
      />
    )
  }

  const pageTitles: Record<string, string> = {
    Overview: organisationType === 'lawma_authority' || organisationType === 'psp_operator'
      ? 'Platform overview'
      : organisationType === 'recycling_facility'
        ? 'Recycler operations overview'
        : ['hospital', 'pharmacy'].includes(organisationType || '')
          ? 'Healthcare partner overview'
          : 'Your BinOps overview',
    Collections: 'Collection management',
    'Collection Requests': 'Collection requests',
    'Payments & Renewal': 'Payments and renewal',
    'History & Receipts': 'Collection history and receipts',
    'Waste Impact': 'Your environmental impact',
    'My Health Credits': 'My Health Credits',
    'Healthcare Partners': 'Healthcare partners',
    'My PSP': 'My waste collection operator',
    Recyclers: 'Recycling partners',
    'My Account': 'My account',
    'PSP Operators': 'PSP operator management',
    Customers: 'Customer management',
    'Health Credits': 'Health Credits',
    'Blockchain Proofs': 'Blockchain verification',
    Organisations: 'Organisation management',
  }

  return (
    <div className={`app-shell ${
      organisationType !== 'lawma_authority' &&
      organisationType !== 'psp_operator' &&
      organisationType !== 'recycling_facility' &&
      !['hospital', 'pharmacy'].includes(organisationType || '')
        ? 'customer-app-shell'
        : ''
    }`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Leaf size={23} /></div>
          <div><strong>BinOps</strong><span>WASTE • HEALTH • TRUST</span></div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => { setActive(label); setMenuOpen(false) }}>
              <Icon size={19} /><span>{label}</span>
              {label === 'Collections' && <span className="nav-count">12</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setActive('Settings')}>
            <Settings size={19} /><span>Settings</span>
          </button>
          <div className="profile">
            <div className="profile-identity">
              <div className="avatar">{initials}</div>
              <div className="profile-info">
                <strong>{user.firstName} {user.lastName}</strong>
                <span>{user.organisations[0]?.type || 'Customer account'}</span>
              </div>
              <ChevronDown size={16} />
            </div>
            <button className="nav-item profile-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><Menu /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          <div className="top-actions">
            <div className="environment"><span></span> Demo environment</div>
            <button className="icon-button" aria-label="Search"><Search size={19} /></button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><i /></button>
            <div className="top-avatar">{initials}</div>
          </div>
        </header>

        <div className="page-content">
          {organisationType === 'psp_operator'
            ? <PSPWorkspace page={active} />
            : organisationType === 'recycling_facility'
              ? <RecyclerWorkspace page={active} />
              : ['hospital', 'pharmacy'].includes(organisationType || '')
                ? <HealthcareWorkspace
                    page={active}
                    organisationType={organisationType as 'hospital' | 'pharmacy'}
                  />
                : organisationType !== 'lawma_authority'
              ? <CustomerWorkspace page={active} onNavigate={setActive} />
              : active === "Overview" ? <>
          <section className="welcome-row">
            <div>
              <div className="eyebrow">TUESDAY, 10 NOVEMBER 2026</div>
              <h1>{pageTitles[active] || active}</h1>
              <p>Monitor waste collection operations and environmental impact across Lagos.</p>
            </div>
            <button className="primary-button" onClick={() => setActive('Collections')}>View collections <ArrowUpRight size={17} /></button>
          </section>

          <section
            className="impact-banner lawma-impact-banner"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(5,43,33,.94), rgba(5,43,33,.76)), url(${oversightHeroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="impact-icon"><Leaf size={25} /></div>
            <div className="impact-copy"><strong>Building cleaner communities, one collection at a time.</strong><span>Coordinating waste services and connecting environmental action to healthcare access.</span></div>
            <div className="impact-tag">BINOPS IMPACT</div>
          </section>

          <section className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>Total collections</span><span className="stat-icon green"><Recycle size={19} /></span></div><strong>1,284</strong><div className="stat-foot positive"><ArrowUpRight size={15} /> 12.8% <span>vs last month</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Active customers</span><span className="stat-icon blue"><Users size={19} /></span></div><strong>846</strong><div className="stat-foot positive"><ArrowUpRight size={15} /> 8.4% <span>vs last month</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>Active PSP operators</span><span className="stat-icon orange"><Truck size={19} /></span></div><strong>24</strong><div className="stat-foot neutral"><Activity size={15} /> 3 areas covered</div></article>
            <article className="stat-card"><div className="stat-top"><span>Health Credits issued</span><span className="stat-icon purple"><Coins size={19} /></span></div><strong>₦350,000</strong><div className="stat-foot positive"><ArrowUpRight size={15} /> 16.2% <span>vs last month</span></div></article>
          </section>

          <section className="content-grid">
            <article className="panel collection-panel">
              <div className="panel-heading"><div><h2>Recent collections</h2><p>Latest collection requests and their status</p></div><button className="text-button" onClick={() => setActive('Collections')}>View all <ArrowUpRight size={15} /></button></div>
              <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>CUSTOMER</th><th>AREA</th><th>PSP OPERATOR</th><th>STATUS</th></tr></thead><tbody>
                {collections.map(item => <tr key={item.id}><td className="reference">{item.id}</td><td className="customer-cell">{item.customer}<span>{item.time}</span></td><td><MapPin size={13} /> {item.area}</td><td>{item.psp}</td><td><span className={`status status-${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span></td></tr>)}
              </tbody></table></div>
            </article>

            <article className="panel activity-panel">
              <div className="panel-heading"><div><h2>Platform activity</h2><p>Operational snapshot</p></div><Activity size={19} className="muted-icon" /></div>
              <div className="activity-item"><div className="activity-symbol green"><CheckCircle2 size={18} /></div><div><strong>Collection verified</strong><span>IKEJA • Oversight verification</span></div><time>09:42</time></div>
              <div className="activity-item"><div className="activity-symbol blue"><Truck size={18} /></div><div><strong>PSP assignment updated</strong><span>LEKKI • Operator assigned</span></div><time>09:18</time></div>
              <div className="activity-item"><div className="activity-symbol purple"><Coins size={18} /></div><div><strong>Health Credits issued</strong><span>Customer rewards ledger</span></div><time>08:50</time></div>
              <div className="activity-item"><div className="activity-symbol orange"><Clock3 size={18} /></div><div><strong>New collection request</strong><span>YABA • Awaiting assignment</span></div><time>08:30</time></div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel metric-panel"><div className="panel-heading"><div><h2>Waste recovery</h2><p>Demonstration performance indicators</p></div><span className="period-label">THIS MONTH</span></div><div className="recovery-value">8.6 <span>tonnes</span></div><div className="progress-track"><div className="progress-fill"></div></div><div className="metric-foot"><span>Recycled and recovered</span><strong>68% of recorded waste</strong></div></article>
            <article className="panel blockchain-panel"><div className="panel-heading"><div><h2>Blockchain network</h2><p>Collection proof infrastructure</p></div><ShieldCheck size={20} className="muted-icon" /></div><div className="chain-status"><span className="online-dot"></span><strong>Local network connected</strong><span className="chain-badge">DEMO</span></div><div className="chain-detail"><span>Network</span><strong>Hardhat · Chain 31337</strong></div><div className="chain-detail"><span>Proof records</span><strong>Local demonstration</strong></div><div className="chain-note"><AlertCircle size={15} /> Demonstration network only. Not a public production deployment.</div></article>
          </section>

          <footer className="footer"><span>© 2026 BinOps · Cleaner communities, healthier lives.</span><span>Demonstration data · Lagos, Nigeria</span></footer>
          </> : active === "Collections" ? <CollectionsPage />
            : active === "PSP Operators" ? <PSPOperatorsPage />
            : <ManagementPages page={active} />}
        </div>
      </main>
    </div>
  )
}

export default App
