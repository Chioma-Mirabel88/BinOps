import recyclerHeroImage from "./assets/binops-recycler-hero.png";
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from './lib/api'
import {
  RefreshCw, Recycle, ClipboardList, MapPin, Search, Clock
} from 'lucide-react'

type RecyclerHandover = {
  id: string
  collectionRequestId: string
  facilityCode: string
  facilityAddress: string
  serviceArea: string
  wasteCategory: string
  quantity: string | number
  quantityUnit: string
  evidenceHash?: string | null
  receivedAt: string
  pspOrganisationName: string
}

type HandoverResponse = {
  count: number
  handovers: RecyclerHandover[]
  error?: string
}

type RecyclerWorkspaceProps = {
  page: string
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded'

  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCategory(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function RecyclerWorkspace({ page }: RecyclerWorkspaceProps) {
  const [handovers, setHandovers] = useState<RecyclerHandover[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const loadHandovers = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const response = await api.get<HandoverResponse>(
        '/recycler/collections/handovers'
      )
      setHandovers(response.data.handovers || [])
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Unable to load incoming handovers. Please try again.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadHandovers()
  }, [loadHandovers])

  const counts = useMemo(() => ({
    total: handovers.length,
    recyclable: handovers.filter(item => item.wasteCategory === 'recyclable').length,
    organic: handovers.filter(item => item.wasteCategory === 'organic').length,
    general: handovers.filter(item => item.wasteCategory === 'general').length,
  }), [handovers])

  const filteredHandovers = handovers.filter(item => {
    const query = search.toLowerCase()

    return (
      item.collectionRequestId.toLowerCase().includes(query) ||
      item.facilityCode.toLowerCase().includes(query) ||
      item.serviceArea.toLowerCase().includes(query) ||
      item.wasteCategory.toLowerCase().includes(query) ||
      item.pspOrganisationName.toLowerCase().includes(query)
    )
  })

  return (
    <div className="page-section">
      <div
        className="section-heading"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5,43,33,.94), rgba(5,43,33,.70)), url(${recyclerHeroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div>
          <h2>
            {page === 'Overview'
              ? 'Recycler Operations Overview'
              : 'Incoming Waste Handovers'}
          </h2>
          <p>
            {page === 'Overview'
              ? 'Monitor waste handovers recorded for your recycling facilities.'
              : 'Review handover records submitted by participating PSP organisations.'}
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => void loadHandovers(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={15} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="stats-grid collection-stats">
        <article className="stat-card">
          <div className="stat-top">
            <span>Total handovers</span>
            <ClipboardList size={19} />
          </div>
          <strong>{counts.total}</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Recyclable</span>
            <Recycle size={19} />
          </div>
          <strong>{counts.recyclable}</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Organic</span>
            <MapPin size={19} />
          </div>
          <strong>{counts.organic}</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>General waste</span>
            <Clock size={19} />
          </div>
          <strong>{counts.general}</strong>
        </article>
      </div>

      {error && <div className="panel" role="alert">{error}</div>}

      {page === 'Overview' ? (
        <div className="panel collection-management-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent incoming handovers</h2>
              <p>Latest handover records associated with your facilities.</p>
            </div>
          </div>

          {loading ? (
            <p>Loading recycler operations...</p>
          ) : handovers.length === 0 ? (
            <p>No incoming handovers have been recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FACILITY</th>
                    <th>SERVICE AREA</th>
                    <th>WASTE TYPE</th>
                    <th>QUANTITY</th>
                    <th>RECORDED</th>
                  </tr>
                </thead>
                <tbody>
                  {handovers.slice(0, 5).map(item => (
                    <tr key={item.id}>
                      <td className="customer-cell">{item.facilityCode}</td>
                      <td>{item.serviceArea}</td>
                      <td>{formatCategory(item.wasteCategory)}</td>
                      <td>{item.quantity} {item.quantityUnit}</td>
                      <td>{formatDate(item.receivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="table-summary">
            Showing up to 5 of {handovers.length} recorded handovers.
          </p>
        </div>
      ) : (
        <div className="panel collection-management-panel">
          <div className="collection-toolbar">
            <div>
              <h2>Handover register</h2>
              <p>Search handovers by facility, service area, waste type or PSP.</p>
            </div>

            <div className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search handovers..."
              />
            </div>
          </div>

          {loading ? (
            <p>Loading incoming handovers...</p>
          ) : filteredHandovers.length === 0 ? (
            <p>No handover records match your search.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>COLLECTION REF.</th>
                    <th>FACILITY</th>
                    <th>SERVICE AREA</th>
                    <th>WASTE TYPE</th>
                    <th>QUANTITY</th>
                    <th>PSP ORGANISATION</th>
                    <th>RECORDED AT</th>
                    <th>EVIDENCE REFERENCE</th>
                    <th>RECORD STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHandovers.map(item => (
                    <tr key={item.id}>
                      <td className="customer-cell">
                        {item.collectionRequestId.slice(0, 8).toUpperCase()}
                      </td>
                      <td>
                        <strong>{item.facilityCode}</strong>
                        <small className="handover-detail">
                          {item.facilityAddress || 'Address not available'}
                        </small>
                      </td>
                      <td>{item.serviceArea}</td>
                      <td>{formatCategory(item.wasteCategory)}</td>
                      <td>{item.quantity} {item.quantityUnit}</td>
                      <td>{item.pspOrganisationName || 'Not available'}</td>
                      <td>{formatDate(item.receivedAt)}</td>
                      <td>
                        {item.evidenceHash ? (
                          <code title={item.evidenceHash}>
                            {item.evidenceHash.slice(0, 12)}...
                          </code>
                        ) : (
                          <span>Not provided</span>
                        )}
                      </td>
                      <td>
                        <span className="status status-collected">
                          Handover recorded
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="table-summary">
            Showing {filteredHandovers.length} of {handovers.length} handover records.
          </p>
        </div>
      )}
    </div>
  )
}

export default RecyclerWorkspace
