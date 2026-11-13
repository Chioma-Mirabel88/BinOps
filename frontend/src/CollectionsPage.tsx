
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from './lib/api'
import { useAuth } from './context/AuthContext'
import {
  Search, Plus, Recycle, Clock, CheckCircle2,
  Truck, MapPin, X, Filter
} from 'lucide-react'

type CollectionStatus =
  | 'Pending'
  | 'Scheduled'
  | 'Assigned'
  | 'In Progress'
  | 'Collected'
  | 'Verified'
  | 'Cancelled'

type Collection = {
  id: string
  customer: string
  area: string
  psp: string
  waste: string
  status: CollectionStatus
  date: string
  serviceAddress?: string
  binFullness?: string
}

type ApiCollection = {
  id: string
  serviceArea: string
  serviceAddress?: string
  wasteCategory: string | null
  binFullness: string
  status: string
  requestedAt: string
  pspOrganisationId?: string | null
  pspOrganisationName?: string | null
  customerName?: string
}

type CollectionsResponse = {
  collectionRequests?: ApiCollection[]
  error?: string
}

type PSPOrganisation = {
  id: string
  name: string
  serviceArea: string | null
}

function mapCollection(
  item: ApiCollection,
  fallbackCustomerName = 'Registered customer'
): Collection {
  const statuses: Record<string, CollectionStatus> = {
    requested: 'Pending',
    assigned: 'Assigned',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    collected: 'Collected',
    verified: 'Verified',
    cancelled: 'Cancelled',
  }

  return {
    id: item.id,
    customer: item.customerName || fallbackCustomerName,
    area: item.serviceArea,
    psp: item.pspOrganisationName || 'Awaiting assignment',
    waste: item.wasteCategory || 'General',
    status: statuses[item.status] || 'Pending',
    date: new Date(item.requestedAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    serviceAddress: item.serviceAddress,
    binFullness: item.binFullness,
  }
}

function CollectionsPage() {
  const { user } = useAuth()
  const organisationType = user?.organisations?.[0]?.type
  const isOversight = organisationType === 'lawma_authority'
  const isPsp = organisationType === 'psp_operator'

  const customerOrganisation = user?.organisations?.find(
    organisation =>
      organisation.type !== 'lawma_authority' &&
      organisation.type !== 'psp_operator'
  )

  const personalCustomerName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(' ')

  const customerDisplayName =
    customerOrganisation?.name || personalCustomerName || 'Registered customer'

  const [collections, setCollections] = useState<Collection[]>([])
  const [pspOrganisations, setPspOrganisations] = useState<PSPOrganisation[]>([])
  const [selectedPspByCollection, setSelectedPspByCollection] = useState<Record<string, string>>({})
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [serviceAddress, setServiceAddress] = useState('')
  const [binFullness, setBinFullness] = useState('full')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [area, setArea] = useState('')
  const [waste, setWaste] = useState('general')

  const loadCollections = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const endpoint = isOversight
        ? '/oversight/collections/pending'
        : isPsp
          ? '/psp/collections'
          : '/collections'

      const response = await api.get<CollectionsResponse>(endpoint)
      setCollections(
        (response.data.collectionRequests || []).map(item =>
          mapCollection(item, customerDisplayName)
        )
      )
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to load collection requests.')
    } finally {
      setLoading(false)
    }
  }, [isOversight, isPsp])

  useEffect(() => {
    void loadCollections()
  }, [loadCollections])

  useEffect(() => {
    if (!isOversight) return

    api.get<{ organisations?: PSPOrganisation[] }>('/users/psp-organisations')
      .then(response => setPspOrganisations(response.data.organisations || []))
      .catch((err: any) => {
        setError(err.response?.data?.error || 'Unable to load active PSP operators.')
      })
  }, [isOversight])

  async function assignPsp(collectionId: string) {
    const pspOrganisationId = selectedPspByCollection[collectionId]
    if (!pspOrganisationId) {
      setError('Select a PSP operator before assigning this request.')
      return
    }

    setActionLoadingId(collectionId)
    setError('')
    try {
      await api.patch(`/oversight/collections/${collectionId}/assign`, {
        pspOrganisationId,
      })
      await loadCollections()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to assign the PSP operator.')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function verifyCollection(collectionId: string) {
    setActionLoadingId(collectionId)
    setError('')
    try {
      await api.patch(`/oversight/collections/${collectionId}/verify`)
      await loadCollections()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to verify this collection.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredCollections = useMemo(() => {
    return collections.filter(item => {
      const matchesSearch =
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        item.customer.toLowerCase().includes(search.toLowerCase()) ||
        item.area.toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === 'All' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [collections, search, statusFilter])

  const counts = {
    total: collections.length,
    pending: collections.filter(c => c.status === 'Pending').length,
    progress: collections.filter(c =>
      ['Scheduled', 'In Progress'].includes(c.status)
    ).length,
    completed: collections.filter(c =>
      ['Collected', 'Verified'].includes(c.status)
    ).length,
  }

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await api.post('/collections', {
        serviceAddress: serviceAddress,
        serviceArea: area,
        wasteCategory: waste,
        binFullness,
      })

      setArea('')
      setWaste('general')
      setServiceAddress('')
      setBinFullness('full')
      setShowForm(false)
      await loadCollections()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to create collection request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-section">
      <div className="section-heading">
        <div>
          <h2>Collection requests</h2>
          <p>Manage customer requests, operator assignments and collection progress.</p>
        </div>
        {!isOversight && !isPsp && (
          <button className="primary-button" onClick={() => setShowForm(true)}>
            <Plus size={17} /> New collection
          </button>
        )}
      </div>

      <div className="stats-grid collection-stats">
        <article className="stat-card">
          <div className="stat-top"><span>Total requests</span><Recycle size={19} /></div>
          <strong>{counts.total}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Pending</span><Clock size={19} /></div>
          <strong>{counts.pending}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>In progress</span><Truck size={19} /></div>
          <strong>{counts.progress}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Collected / verified</span><CheckCircle2 size={19} /></div>
          <strong>{counts.completed}</strong>
        </article>
      </div>

      {error && <div className="panel" role="alert">{error}</div>}

      {showForm && (
        <div className="panel collection-form-panel">
          <div className="panel-heading">
            <div>
              <h2>New collection request</h2>
              <p>Submit a waste collection request.</p>
            </div>
            <button className="icon-button" onClick={() => setShowForm(false)}>
              <X size={19} />
            </button>
          </div>

          <form onSubmit={createCollection} className="collection-form">
            <label>
              Service address
              <input required value={serviceAddress}
                onChange={e => setServiceAddress(e.target.value)}
                placeholder="Enter service address" />
            </label>
            <label>
              Service area
              <input required value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="e.g. Ikeja" />
            </label>
            <label>
              Waste category
              <select value={waste} onChange={e => setWaste(e.target.value)}>
                <option value="general">General</option>
                <option value="recyclable">Recyclable</option>
                <option value="organic">Organic</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Bin fullness
              <select value={binFullness} onChange={e => setBinFullness(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="full">Full</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="secondary-button"
                onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Create request'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel collection-management-panel">
        <div className="collection-toolbar">
          <div>
            <h2>All collections</h2>
            <p>Search and filter collection requests.</p>
          </div>
          <div className="collection-filters">
            <div className="search-field">
              <Search size={17} />
              <input value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search collections..." />
            </div>
            <div className="filter-field">
              <Filter size={16} />
              <select value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}>
                <option>All</option>
                <option>Pending</option>
                <option>Scheduled</option>
                <option>In Progress</option>
                <option>Collected</option>
                <option>Verified</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REFERENCE</th>
                <th>CUSTOMER</th>
                <th>SERVICE AREA</th>
                <th>PSP OPERATOR</th>
                <th>WASTE TYPE</th>
                <th>DATE</th>
                <th>STATUS</th>
                {isOversight && <th>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isOversight ? 8 : 7}>Loading collection requests...</td></tr>
              ) : filteredCollections.map(item => (
                <tr key={item.id}>
                  <td className="reference">{item.id}</td>
                  <td className="customer-cell">{item.customer}</td>
                  <td><MapPin size={13} /> {item.area}</td>
                  <td>{item.psp}</td>
                  <td>{item.waste}</td>
                  <td>{item.date}</td>
                  <td>
                    <span className={`status status-${item.status.toLowerCase().replace(' ', '-')}`}>
                      {item.status}
                    </span>
                  </td>
                  {isOversight && (
                    <td>
                      {item.status === 'Pending' ? (
                        <div className="form-actions">
                          <select
                            aria-label={`PSP operator for ${item.id}`}
                            value={selectedPspByCollection[item.id] || ''}
                            onChange={event => setSelectedPspByCollection(current => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))}
                            disabled={actionLoadingId === item.id}
                          >
                            <option value="">Select PSP</option>
                            {pspOrganisations.map(psp => (
                              <option key={psp.id} value={psp.id}>{psp.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => void assignPsp(item.id)}
                            disabled={actionLoadingId === item.id || pspOrganisations.length === 0}
                          >
                            {actionLoadingId === item.id ? 'Assigning...' : 'Assign'}
                          </button>
                        </div>
                      ) : item.status === 'Collected' ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void verifyCollection(item.id)}
                          disabled={actionLoadingId === item.id}
                        >
                          {actionLoadingId === item.id ? 'Verifying...' : 'Verify'}
                        </button>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))}
              {filteredCollections.length === 0 && (
                <tr>
                  <td colSpan={isOversight ? 8 : 7}>No collection requests match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="table-summary">
          Showing {filteredCollections.length} of {collections.length} live collection records.
        </p>
      </div>
    </div>
  )
}

export default CollectionsPage
