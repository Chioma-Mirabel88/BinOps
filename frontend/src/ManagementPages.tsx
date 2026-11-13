import { useEffect, useMemo, useState } from "react"
import api from "./lib/api"
import {
  Search, Plus, Users, ShieldCheck, Building2, Truck,
  Settings, CheckCircle2, Clock, X, Leaf
} from "lucide-react"

type Props = { page: string }

const customersData = [
  { id: "CUS-001", name: "Adeola Family", type: "Individual", area: "Lekki", email: "adeola@demo.binops", status: "Active" },
  { id: "CUS-002", name: "Greenfield Apartments", type: "Business", area: "Ikeja", email: "greenfield@demo.binops", status: "Active" },
  { id: "CUS-003", name: "Market Square Ltd", type: "Business", area: "Yaba", email: "market@demo.binops", status: "Active" },
  { id: "CUS-004", name: "Chioma O", type: "Individual", area: "Ikeja", email: "chioma@demo.binops", status: "Active" },
]

const organisationsData = [
  { id: "ORG-001", name: "BinOps Demo PSP", type: "PSP Operator", area: "Ikeja", status: "Active" },
  { id: "ORG-002", name: "BinOps Demo Business", type: "Business", area: "Ikeja", status: "Active" },
  { id: "ORG-003", name: "BinOps Demo Oversight", type: "Oversight", area: "Lagos", status: "Active" },
  { id: "ORG-004", name: "Demo Healthcare Partner", type: "Healthcare", area: "Lagos", status: "Pending" },
]

function Customers() {
  const [items, setItems] = useState(customersData)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [type, setType] = useState("Individual")
  const [area, setArea] = useState("")

  const filtered = useMemo(() => items.filter(item =>
    `${item.name} ${item.email} ${item.area} ${item.id}`.toLowerCase().includes(search.toLowerCase())
  ), [items, search])

  function addCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setItems(previous => [{
      id: `CUS-${Date.now()}`, name, email, type, area, status: "Active"
    }, ...previous])
    setName(""); setEmail(""); setArea(""); setShowForm(false)
  }

  return <div className="page-section">
    <div className="section-heading">
      <div><h2>Customer directory</h2><p>Manage individual and business customers.</p></div>
      <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={17}/> Add customer</button>
    </div>
    <div className="stats-grid collection-stats">
      <article className="stat-card"><div className="stat-top">Total customers <Users size={19}/></div><strong>{items.length}</strong></article>
      <article className="stat-card"><div className="stat-top">Individuals <Users size={19}/></div><strong>{items.filter(x => x.type === "Individual").length}</strong></article>
      <article className="stat-card"><div className="stat-top">Businesses <Building2 size={19}/></div><strong>{items.filter(x => x.type === "Business").length}</strong></article>
      <article className="stat-card"><div className="stat-top">Active accounts <CheckCircle2 size={19}/></div><strong>{items.filter(x => x.status === "Active").length}</strong></article>
    </div>
    {showForm && <div className="panel collection-form-panel">
      <div className="panel-heading"><div><h2>Register customer</h2><p>Add a demonstration customer.</p></div><button className="icon-button" onClick={() => setShowForm(false)}><X size={19}/></button></div>
      <form className="collection-form" onSubmit={addCustomer}>
        <label>Customer name<input required value={name} onChange={e => setName(e.target.value)}/></label>
        <label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
        <label>Customer type<select value={type} onChange={e => setType(e.target.value)}><option>Individual</option><option>Business</option></select></label>
        <label>Service area<input required value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Ikeja"/></label>
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Register customer</button></div>
      </form>
    </div>}
    <div className="panel collection-management-panel">
      <div className="collection-toolbar"><div><h2>All customers</h2><p>Customer account directory.</p></div><div className="collection-filters"><div className="search-field"><Search size={17}/><input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)}/></div></div></div>
      <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>CUSTOMER</th><th>TYPE</th><th>EMAIL</th><th>SERVICE AREA</th><th>STATUS</th></tr></thead><tbody>
        {filtered.map(x => <tr key={x.id}><td className="reference">{x.id}</td><td>{x.name}</td><td>{x.type}</td><td>{x.email}</td><td>{x.area}</td><td><span className="status status-verified">{x.status}</span></td></tr>)}
        {!filtered.length && <tr><td colSpan={6}>No matching customers.</td></tr>}
      </tbody></table></div>
      <p className="table-summary">Demonstration records. Customer information is not connected to the live database.</p>
    </div>
  </div>
}

function HealthCredits() {
  const [funding, setFunding] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [sourceType, setSourceType] = useState("sponsorship")
  const [sourceReference, setSourceReference] = useState("")
  const [amountFunded, setAmountFunded] = useState("")
  const [confirmId, setConfirmId] = useState("")
  const [accountId, setAccountId] = useState("")
  const [fundingId, setFundingId] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [description, setDescription] = useState("")

  async function loadData() {
    setLoading(true)
    try {
      const response = await api.get("/oversight/health-credits/management")
      setFunding(response.data.funding || [])
      setTransactions(response.data.transactions || [])
      setError("")
    } catch (err: any) {
      setError(err.response?.data?.error || "Unable to load Health Credits data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  async function createFunding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")
    try {
      await api.post("/oversight/health-credits/funding", {
        sourceType,
        sourceReference: sourceReference.trim() || undefined,
        amountFunded: Number(amountFunded),
      })
      setNotice("Funding record created. It is pending confirmation.")
      setSourceReference("")
      setAmountFunded("")
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || "Unable to create funding record.")
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmFunding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")
    try {
      await api.patch("/oversight/health-credits/funding/" + encodeURIComponent(confirmId.trim()) + "/confirm")
      setNotice("Funding record confirmed.")
      setConfirmId("")
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || "Unable to confirm funding.")
    } finally {
      setSubmitting(false)
    }
  }

  async function issueCredits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    setNotice("")
    try {
      await api.post("/oversight/health-credits/issuance", {
        accountId: accountId.trim(),
        fundingId: fundingId.trim(),
        amount: Number(creditAmount),
        idempotencyKey: crypto.randomUUID(),
        description: description.trim() || undefined,
      })
      setNotice("Health Credits issued successfully.")
      setAccountId("")
      setFundingId("")
      setCreditAmount("")
      setDescription("")
      await loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || "Unable to issue Health Credits.")
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="page-section">
    <div className="section-heading">
      <div><h2>Health Credits management</h2><p>Manage funding, confirmation and credit issuance.</p></div>
      <button className="secondary-button" onClick={() => void loadData()} disabled={loading}>Refresh</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}

    <div className="panel collection-form-panel">
      <div className="panel-heading"><div><h2>1. Create funding record</h2><p>New funding must be confirmed before it can support issuance.</p></div></div>
      <form className="collection-form" onSubmit={createFunding}>
        <label>Funding source
          <select value={sourceType} onChange={e => setSourceType(e.target.value)}>
            <option value="subscription_allocation">Subscription allocation</option>
            <option value="sponsorship">Sponsorship</option>
            <option value="csr">CSR</option>
            <option value="grant">Grant</option>
            <option value="provider_contribution">Provider contribution</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Funding amount (NGN)
          <input required type="number" min="0.01" step="0.01" value={amountFunded} onChange={e => setAmountFunded(e.target.value)} />
        </label>
        <label>Source reference (optional)
          <input value={sourceReference} onChange={e => setSourceReference(e.target.value)} />
        </label>
        <div className="form-actions"><button className="primary-button" disabled={submitting}>Create funding</button></div>
      </form>
    </div>

    <div className="panel collection-form-panel">
      <div className="panel-heading"><div><h2>2. Confirm funding</h2><p>Enter the funding record UUID to confirm it.</p></div></div>
      <form className="collection-form" onSubmit={confirmFunding}>
        <label>Funding record ID
          <input required value={confirmId} onChange={e => setConfirmId(e.target.value)} placeholder="Funding UUID" />
        </label>
        <div className="form-actions"><button className="primary-button" disabled={submitting}>Confirm funding</button></div>
      </form>
    </div>

    <div className="panel collection-form-panel">
      <div className="panel-heading"><div><h2>3. Issue Health Credits</h2><p>Issue credits to an existing active account using confirmed funding.</p></div></div>
      <form className="collection-form" onSubmit={issueCredits}>
        <label>Health Credit account ID
          <input required value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="Account UUID" />
        </label>
        <label>Confirmed funding ID
          <input required value={fundingId} onChange={e => setFundingId(e.target.value)} placeholder="Funding UUID" />
        </label>
        <label>Credits to issue (BHC)
          <input required type="number" min="0.01" step="0.01" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
        </label>
        <label>Description (optional)
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <div className="form-actions"><button className="primary-button" disabled={submitting}>Issue credits</button></div>
      </form>
      <p className="table-summary">Use existing account and funding UUIDs. The backend validates account status, funding confirmation, available funding and duplicate requests.</p>
    </div>

    <div className="panel collection-management-panel">
      <div className="collection-toolbar"><div><h2>Funding records</h2><p>Live records from the database.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>FUNDING ID</th><th>SOURCE</th><th>REFERENCE</th><th>AMOUNT</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>
        {funding.map(x => <tr key={x.id}><td className="reference">{x.id}</td><td>{x.sourceType}</td><td>{x.sourceReference || "-"}</td><td>{Number(x.amountFunded).toLocaleString()} {x.currency}</td><td><span className={"status " + (x.status === "confirmed" ? "status-verified" : "status-pending")}>{x.status}</span></td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
        {!loading && funding.length === 0 && <tr><td colSpan={6}>No funding records found.</td></tr>}
      </tbody></table></div>
    </div>

    <div className="panel collection-management-panel">
      <div className="collection-toolbar"><div><h2>Credit transactions</h2><p>Live issuance and redemption ledger.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>TRANSACTION ID</th><th>ACCOUNT ID</th><th>TYPE</th><th>AMOUNT (BHC)</th><th>DESCRIPTION</th><th>DATE</th></tr></thead><tbody>
        {transactions.map(x => <tr key={x.id}><td className="reference">{x.id}</td><td>{x.accountId}</td><td>{x.transactionType}</td><td>{Number(x.creditDelta).toLocaleString()}</td><td>{x.description || "-"}</td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
        {!loading && transactions.length === 0 && <tr><td colSpan={6}>No credit transactions found.</td></tr>}
      </tbody></table></div>
      <p className="table-summary">Funding is denominated in NGN; Health Credit transactions are denominated in BHC.</p>
    </div>
    {loading && <p className="table-summary">Loading Health Credits records...</p>}
  </div>
}

function BlockchainProofs() {
  const [proofs, setProofs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadProofs() {
    setLoading(true)
    setError("")
    try {
      const response = await api.get("/oversight/blockchain/proofs")
      setProofs(response.data.proofs || [])
    } catch (err: any) {
      setError(err.response?.data?.error || "Unable to load blockchain proof records.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadProofs() }, [])

  const verified = proofs.filter(x => x.verificationStatus === "verified").length
  const confirmed = proofs.filter(x => x.status === "confirmed").length
  const pending = proofs.filter(x => x.status === "pending").length

  return <div className="page-section">
    <div className="section-heading">
      <div><h2>Blockchain verification</h2><p>Collection evidence records and on-chain verification results.</p></div>
      <button className="secondary-button" onClick={() => void loadProofs()} disabled={loading}>Refresh</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="stats-grid collection-stats">
      <article className="stat-card"><div className="stat-top">Proof records <ShieldCheck size={19}/></div><strong>{proofs.length}</strong></article>
      <article className="stat-card"><div className="stat-top">Verified on-chain <CheckCircle2 size={19}/></div><strong>{verified}</strong></article>
      <article className="stat-card"><div className="stat-top">Confirmed records <Clock size={19}/></div><strong>{confirmed}</strong></article>
      <article className="stat-card"><div className="stat-top">Pending records <Leaf size={19}/></div><strong>{pending}</strong></article>
    </div>
    <div className="panel collection-management-panel">
      <div className="collection-toolbar"><div><h2>Collection proof records</h2><p>Live proof records with blockchain verification status.</p></div><span className="chain-badge">LOCAL DEMO - CHAIN 31337</span></div>
      <div className="table-wrap"><table><thead><tr><th>PROOF ID</th><th>COLLECTION REQUEST</th><th>EVIDENCE HASH</th><th>TRANSACTION HASH</th><th>RECORD STATUS</th><th>VERIFICATION</th><th>CREATED</th></tr></thead><tbody>
        {proofs.map(x => <tr key={x.id}><td className="reference">{x.id}</td><td className="reference">{x.collectionRequestId}</td><td><code>{x.evidenceHash}</code></td><td><code>{x.transactionHash || "-"}</code></td><td><span className={`status ${x.status === "confirmed" ? "status-verified" : "status-pending"}`}>{x.status}</span></td><td><span className={`status ${x.verificationStatus === "verified" ? "status-verified" : "status-pending"}`}>{x.verificationStatus}</span></td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
        {!loading && proofs.length === 0 && <tr><td colSpan={7}>No collection proof records found.</td></tr>}
      </tbody></table></div>
      <p className="table-summary">This demonstration uses the local Hardhat network (chain ID 31337), not a public blockchain. Verified means the on-chain collection reference and evidence hash match the database record.</p>
      {loading && <p className="table-summary">Loading proof records...</p>}
    </div>
  </div>
}

function Organisations() {
  const [search, setSearch] = useState("")
  const filtered = organisationsData.filter(x => `${x.name} ${x.type} ${x.area}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="page-section">
    <div className="section-heading"><div><h2>Organisation directory</h2><p>View participating organisation types and service areas.</p></div></div>
    <div className="stats-grid collection-stats">
      <article className="stat-card"><div className="stat-top">Organisations <Building2 size={19}/></div><strong>{organisationsData.length}</strong></article>
      <article className="stat-card"><div className="stat-top">PSP operators <Truck size={19}/></div><strong>1</strong></article>
      <article className="stat-card"><div className="stat-top">Healthcare partners <CheckCircle2 size={19}/></div><strong>1</strong></article>
      <article className="stat-card"><div className="stat-top">Oversight <ShieldCheck size={19}/></div><strong>1</strong></article>
    </div>
    <div className="panel collection-management-panel">
      <div className="collection-toolbar"><div><h2>Registered organisations</h2><p>Demonstration organisation directory.</p></div><div className="search-field"><Search size={17}/><input placeholder="Search organisations..." value={search} onChange={e => setSearch(e.target.value)}/></div></div>
      <div className="table-wrap"><table><thead><tr><th>REFERENCE</th><th>ORGANISATION</th><th>TYPE</th><th>SERVICE AREA</th><th>STATUS</th></tr></thead><tbody>
        {filtered.map(x => <tr key={x.id}><td className="reference">{x.id}</td><td>{x.name}</td><td>{x.type}</td><td>{x.area}</td><td><span className={`status ${x.status === "Active" ? "status-verified" : "status-pending"}`}>{x.status}</span></td></tr>)}
      </tbody></table></div>
      <p className="table-summary">Demo organisations only. No LAWMA partnership or endorsement is implied.</p>
    </div>
  </div>
}

function SettingsPage() {
  const [notifications, setNotifications] = useState(true)
  const [demoMode, setDemoMode] = useState(true)
  return <div className="page-section">
    <div className="section-heading"><div><h2>Platform settings</h2><p>Review application preferences and demonstration environment configuration.</p></div></div>
    <div className="panel collection-management-panel">
      <div className="panel-heading"><div><h2>Application preferences</h2><p>Local interface settings.</p></div><Settings size={20}/></div>
      <div className="settings-row"><div><strong>In-app notifications</strong><p>Show operational notification indicators in the interface.</p></div><input type="checkbox" checked={notifications} onChange={e => setNotifications(e.target.checked)}/></div>
      <div className="settings-row"><div><strong>Demonstration mode</strong><p>Clearly identify synthetic data and local test infrastructure.</p></div><input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)}/></div>
    </div>
    <div className="panel collection-management-panel">
      <div className="panel-heading"><div><h2>Blockchain environment</h2><p>Current local development configuration.</p></div><ShieldCheck size={20}/></div>
      <div className="chain-detail"><span>Network</span><strong>Hardhat local development network</strong></div>
      <div className="chain-detail"><span>Chain ID</span><strong>31337</strong></div>
      <div className="chain-detail"><span>RPC endpoint</span><strong>127.0.0.1:8545</strong></div>
      <div className="chain-note"><Clock size={15}/> Local demonstration configuration. No production settings are changed here.</div>
    </div>
  </div>
}

export default function ManagementPages({ page }: Props) {
  switch (page) {
    case "Customers": return <Customers />
    case "Health Credits": return <HealthCredits />
    case "Blockchain Proofs": return <BlockchainProofs />
    case "Organisations": return <Organisations />
    case "Settings": return <SettingsPage />
    default: return <div className="panel">Page not found.</div>
  }
}
