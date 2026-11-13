import { useMemo, useState } from "react"
import { Search, Plus, Truck, MapPin, CheckCircle2, Clock, X } from "lucide-react"

type Operator = {
  id: string
  name: string
  contact: string
  email: string
  area: string
  collections: number
  completed: number
  status: "Active" | "Inactive"
}

const initialOperators: Operator[] = [
  { id: "PSP-001", name: "CleanCity Services", contact: "08030000001", email: "cleancity@demo.binops", area: "Ikeja, Yaba", collections: 145, completed: 132, status: "Active" },
  { id: "PSP-002", name: "EcoWaste Lagos", contact: "08030000002", email: "ecowaste@demo.binops", area: "Lekki, Ajah", collections: 118, completed: 105, status: "Active" },
  { id: "PSP-003", name: "GreenPath Waste", contact: "08030000003", email: "greenpath@demo.binops", area: "Ikeja, Maryland", collections: 96, completed: 81, status: "Active" },
  { id: "PSP-004", name: "UrbanClean Services", contact: "08030000004", email: "urbanclean@demo.binops", area: "Surulere, Mushin", collections: 64, completed: 42, status: "Inactive" },
]

export default function PSPOperatorsPage() {
  const [operators, setOperators] = useState(initialOperators)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [area, setArea] = useState("")

  const filtered = useMemo(() => operators.filter(operator => {
    const term = search.toLowerCase()
    const matchesSearch = operator.name.toLowerCase().includes(term) ||
      operator.id.toLowerCase().includes(term) ||
      operator.area.toLowerCase().includes(term)
    return matchesSearch && (filter === "All" || operator.status === filter)
  }), [operators, search, filter])

  const activeCount = operators.filter(operator => operator.status === "Active").length
  const totalCollections = operators.reduce((sum, operator) => sum + operator.collections, 0)
  const completedCollections = operators.reduce((sum, operator) => sum + operator.completed, 0)

  function addOperator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOperators(previous => [{
      id: `PSP-${String(Date.now()).slice(-6)}`,
      name, contact, email, area, collections: 0, completed: 0, status: "Active"
    }, ...previous])
    setName("")
    setContact("")
    setEmail("")
    setArea("")
    setShowForm(false)
  }

  function toggleStatus(id: string) {
    setOperators(previous => previous.map(operator =>
      operator.id === id
        ? { ...operator, status: operator.status === "Active" ? "Inactive" : "Active" }
        : operator
    ))
  }

  return (
    <div className="page-section">
      <div className="section-heading">
        <div>
          <h2>PSP operator directory</h2>
          <p>Manage waste collection organisations, service coverage and performance.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(true)}>
          <Plus size={17} /> Add operator
        </button>
      </div>

      <div className="stats-grid collection-stats">
        <article className="stat-card"><div className="stat-top"><span>Registered operators</span><Truck size={19} /></div><strong>{operators.length}</strong></article>
        <article className="stat-card"><div className="stat-top"><span>Active operators</span><CheckCircle2 size={19} /></div><strong>{activeCount}</strong></article>
        <article className="stat-card"><div className="stat-top"><span>Total assigned collections</span><Clock size={19} /></div><strong>{totalCollections}</strong></article>
        <article className="stat-card"><div className="stat-top"><span>Completed collections</span><CheckCircle2 size={19} /></div><strong>{completedCollections}</strong></article>
      </div>

      {showForm && (
        <div className="panel collection-form-panel">
          <div className="panel-heading">
            <div><h2>Register PSP operator</h2><p>Add a demonstration operator organisation.</p></div>
            <button className="icon-button" onClick={() => setShowForm(false)}><X size={19} /></button>
          </div>
          <form className="collection-form" onSubmit={addOperator}>
            <label>Organisation name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Enter organisation name" /></label>
            <label>Contact number<input required value={contact} onChange={e => setContact(e.target.value)} placeholder="Enter phone number" /></label>
            <label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address" /></label>
            <label>Service areas<input required value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Ikeja, Yaba" /></label>
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button">Register operator</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel collection-management-panel">
        <div className="collection-toolbar">
          <div><h2>All PSP operators</h2><p>Operator directory and collection performance.</p></div>
          <div className="collection-filters">
            <div className="search-field"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search operators..." /></div>
            <div className="filter-field"><select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>OPERATOR</th><th>CONTACT</th><th>SERVICE AREAS</th><th>ASSIGNED</th><th>COMPLETED</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              {filtered.map(operator => (
                <tr key={operator.id}>
                  <td className="customer-cell"><strong>{operator.name}</strong><span>{operator.id}</span></td>
                  <td>{operator.contact}<br />{operator.email}</td>
                  <td><MapPin size={13} /> {operator.area}</td>
                  <td>{operator.collections}</td>
                  <td>{operator.completed}</td>
                  <td><span className={`status ${operator.status === "Active" ? "status-verified" : "status-pending"}`}>{operator.status}</span></td>
                  <td><button className="text-button" onClick={() => toggleStatus(operator.id)}>{operator.status === "Active" ? "Deactivate" : "Activate"}</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7}>No operators match your search.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="table-summary">Showing {filtered.length} of {operators.length} demonstration operators. Performance figures are illustrative.</p>
      </div>
    </div>
  )
}
