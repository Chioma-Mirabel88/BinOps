import pspHeroImage from "./assets/binops-psp-hero.png";
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from './lib/api'
import {
  RefreshCw, Clock, Truck, CheckCircle2, MapPin,
  CalendarClock, Play, Check, Search
} from 'lucide-react'

type PspCollection = {
  id: string
  customerName: string
  serviceArea: string
  serviceAddress?: string
  wasteCategory: string
  binFullness: string
  status: string
  requestedAt: string
  scheduledFor?: string | null
  completedAt?: string | null
}

type CollectionResponse = {
  count: number
  collectionRequests: PspCollection[]
  error?: string
}

type HandoverFacility = {
  id: string
  name: string
  facilityCode: string
  facilityAddress: string
  serviceArea: string
}

type HandoverFacilitiesResponse = {
  count: number
  facilities: HandoverFacility[]
  error?: string
}

type PSPWorkspaceProps = {
  page: string
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled'

  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    requested: 'Pending',
    assigned: 'Assigned',
    scheduled: 'Scheduled',
    in_progress: 'In progress',
    collected: 'Collected',
    verified: 'Verified',
  }

  return labels[status] || status
}

function PSPWorkspace({ page }: PSPWorkspaceProps) {
  const [available, setAvailable] = useState<PspCollection[]>([])
  const [assigned, setAssigned] = useState<PspCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionId, setActionId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [scheduleValues, setScheduleValues] = useState<Record<string, string>>({})
  const [weightValues, setWeightValues] = useState<Record<string, string>>({})
  const [handoverFacilities, setHandoverFacilities] = useState<Record<string, HandoverFacility[]>>({})
  const [selectedFacilities, setSelectedFacilities] = useState<Record<string, string>>({})
  const [handoverQuantities, setHandoverQuantities] = useState<Record<string, string>>({})
  const [handoverLoadingId, setHandoverLoadingId] = useState('')

  const loadCollections = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const [availableResponse, assignedResponse] = await Promise.all([
        api.get<CollectionResponse>('/psp/collections/available'),
        api.get<CollectionResponse>('/psp/collections'),
      ])

      setAvailable(availableResponse.data.collectionRequests || [])
      setAssigned(assignedResponse.data.collectionRequests || [])
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Unable to load PSP collections. Please try again.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadCollections()
  }, [loadCollections])

  const counts = useMemo(() => ({
    available: available.length,
    assigned: assigned.length,
    inProgress: assigned.filter(item => item.status === 'in_progress').length,
    completed: assigned.filter(item =>
      ['collected', 'verified'].includes(item.status)
    ).length,
  }), [available, assigned])

  const filteredAvailable = available.filter(item => {
    const query = search.toLowerCase()
    return (
      item.customerName.toLowerCase().includes(query) ||
      item.serviceArea.toLowerCase().includes(query)
    )
  })

  const filteredAssigned = assigned.filter(item => {
    const query = search.toLowerCase()
    return (
      item.customerName.toLowerCase().includes(query) ||
      item.serviceArea.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    )
  })

  async function performAction(
    id: string,
    action: 'accept' | 'schedule' | 'start' | 'complete',
    collectedWeightKg?: number
  ) {
    setActionId(id)
    setError('')
    setNotice('')

    try {
      if (action === 'accept') {
        await api.post(`/psp/collections/${id}/accept`)
        setNotice('Collection request accepted successfully.')
      }

      if (action === 'schedule') {
        const selectedDate = scheduleValues[id]

        if (!selectedDate) {
          setError('Select a collection date and time before scheduling.')
          return
        }

        const scheduledFor = new Date(selectedDate).toISOString()

        await api.patch(`/psp/collections/${id}/status`, {
          status: 'scheduled',
          scheduledFor,
        })
        setNotice('Collection scheduled successfully.')
      }

      if (action === 'start') {
        await api.patch(`/psp/collections/${id}/status`, {
          status: 'in_progress',
        })
        setNotice('Collection marked as in progress.')
      }

      if (action === 'complete') {
        if (!collectedWeightKg || !Number.isFinite(collectedWeightKg) || collectedWeightKg <= 0) {
          setError('Enter the actual collected weight in KG.')
          return
        }

        const response = await api.patch(`/psp/collections/${id}/status`, {
          status: 'collected',
          collectedWeightKg,
        })

        const collection = response.data.collectionRequest

        const rewardNotice =
          collection?.rewardStatus === 'issued'
            ? `${collection.healthCreditsReward} BHC reward issued.`
            : collection?.rewardStatus === 'pending'
              ? `${collection.healthCreditsReward} BHC reward is pending funding.`
              : 'No individual Health Credits reward applies.'

        const blockchainNotice =
          collection?.blockchainStatus === 'confirmed'
            ? 'Blockchain proof confirmed.'
            : collection?.blockchainStatus === 'failed'
              ? 'Blockchain proof submission failed and requires follow-up.'
              : 'Blockchain proof was not applicable.'

        setNotice(`Collection completed. ${rewardNotice} ${blockchainNotice}`)

        setWeightValues(current => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }

      await loadCollections(true)
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'The requested collection action could not be completed.'
      )
    } finally {
      setActionId('')
    }
  }


  async function loadHandoverFacilities(collectionId: string) {
    setHandoverLoadingId(collectionId)
    setError('')
    setNotice('')

    try {
      const response = await api.get<HandoverFacilitiesResponse>(
        `/psp/collections/${collectionId}/handover-facilities`
      )

      setHandoverFacilities(current => ({
        ...current,
        [collectionId]: response.data.facilities || [],
      }))

      if (!response.data.facilities?.length) {
        setNotice('No approved recycling facilities are currently available in this collection service area.')
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Unable to load approved recycling facilities.'
      )
    } finally {
      setHandoverLoadingId('')
    }
  }

  async function submitWasteHandover(item: PspCollection) {
    const facilityId = selectedFacilities[item.id]
    const quantity = Number(handoverQuantities[item.id])

    if (!facilityId) {
      setError('Select an approved recycling facility before recording the handover.')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a valid handover quantity in kilograms.')
      return
    }

    setActionId(item.id)
    setError('')
    setNotice('')

    try {
      await api.post(`/psp/collections/${item.id}/handover`, {
        facilityId,
        wasteCategory: item.wasteCategory,
        quantity,
        quantityUnit: 'kg',
      })

      setNotice('Waste handover recorded successfully.')

      setHandoverFacilities(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      setSelectedFacilities(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      setHandoverQuantities(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      await loadCollections(true)
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Unable to record the waste handover. Please try again.'
      )
    } finally {
      setActionId('')
    }
  }

  return (
    <div className="page-section">
      <div
        className="section-heading"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5,43,33,.94), rgba(5,43,33,.70)), url(${pspHeroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div>
          <h2>{page === 'Overview' ? 'PSP Operations Overview' : 'Collection Operations'}</h2>
          <p>
            {page === 'Overview'
              ? 'Monitor available work and your collection operations.'
              : 'Accept customer requests and manage your assigned collections.'}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void loadCollections(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={15} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="stats-grid collection-stats">
        <article className="stat-card">
          <div className="stat-top"><span>Available requests</span><Clock size={19} /></div>
          <strong>{counts.available}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Assigned collections</span><Truck size={19} /></div>
          <strong>{counts.assigned}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>In progress</span><CalendarClock size={19} /></div>
          <strong>{counts.inProgress}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Collected / verified</span><CheckCircle2 size={19} /></div>
          <strong>{counts.completed}</strong>
        </article>
      </div>

      {error && <div className="panel" role="alert">{error}</div>}
      {notice && <div className="panel" role="status">{notice}</div>}

      {page === 'Overview' ? (
        <div className="panel collection-management-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent assigned collections</h2>
              <p>Your latest collection assignments and their progress.</p>
            </div>
          </div>

          {loading ? (
            <p>Loading PSP operations...</p>
          ) : assigned.length === 0 ? (
            <p>No assigned collections yet. Check the available requests queue.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>SERVICE AREA</th>
                    <th>WASTE TYPE</th>
                    <th>SCHEDULE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {assigned.slice(0, 5).map(item => (
                    <tr key={item.id}>
                      <td className="customer-cell">{item.customerName}</td>
                      <td><MapPin size={13} /> {item.serviceArea}</td>
                      <td>{item.wasteCategory}</td>
                      <td>{formatDate(item.scheduledFor)}</td>
                      <td>
                        <span className={`status status-${formatStatus(item.status).toLowerCase().replace(' ', '-')}`}>
                          {formatStatus(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="table-summary">
            Showing up to 5 of {assigned.length} assigned collections.
          </p>
        </div>
      ) : (
        <>
          <div className="collection-toolbar">
            <div>
              <h2>Collection requests</h2>
              <p>Search available and assigned collection records.</p>
            </div>
            <div className="search-field">
              <Search size={17} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search customer or area..."
              />
            </div>
          </div>

          <div className="panel collection-management-panel">
            <div className="panel-heading">
              <div>
                <h2>Available requests</h2>
                <p>Unassigned general-waste requests available for acceptance.</p>
              </div>
            </div>

            {loading ? (
              <p>Loading available requests...</p>
            ) : filteredAvailable.length === 0 ? (
              <p>No available requests match your search.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>SERVICE AREA</th>
                      <th>WASTE TYPE</th>
                      <th>BIN FULLNESS</th>
                      <th>REQUESTED</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAvailable.map(item => (
                      <tr key={item.id}>
                        <td className="customer-cell">{item.customerName}</td>
                        <td><MapPin size={13} /> {item.serviceArea}</td>
                        <td>{item.wasteCategory}</td>
                        <td>{item.binFullness}</td>
                        <td>{formatDate(item.requestedAt)}</td>
                        <td>
                          <button
                            className="primary-button"
                            disabled={actionId === item.id}
                            onClick={() => void performAction(item.id, 'accept')}
                          >
                            {actionId === item.id ? 'Accepting...' : 'Accept request'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel collection-management-panel">
            <div className="panel-heading">
              <div>
                <h2>Assigned collections</h2>
                <p>Manage the requests assigned to your PSP organisation.</p>
              </div>
            </div>

            {loading ? (
              <p>Loading assigned collections...</p>
            ) : filteredAssigned.length === 0 ? (
              <p>No assigned collections match your search.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>SERVICE ADDRESS</th>
                      <th>WASTE TYPE</th>
                      <th>SCHEDULE</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssigned.map(item => (
                      <tr key={item.id}>
                        <td className="customer-cell">{item.customerName}</td>
                        <td>{item.serviceAddress || item.serviceArea}</td>
                        <td>{item.wasteCategory}</td>
                        <td>
                          {item.status === 'assigned' ? (
                            <input
                              type="datetime-local"
                              value={scheduleValues[item.id] || ''}
                              onChange={event => setScheduleValues(current => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))}
                              aria-label={`Schedule collection for ${item.customerName}`}
                            />
                          ) : formatDate(item.scheduledFor)}
                        </td>
                        <td>
                          <span className={`status status-${formatStatus(item.status).toLowerCase().replace(' ', '-')}`}>
                            {formatStatus(item.status)}
                          </span>
                        </td>
                        <td>
                          {item.status === 'assigned' && (
                            <button
                              className="primary-button"
                              disabled={actionId === item.id}
                              onClick={() => void performAction(item.id, 'schedule')}
                            >
                              <CalendarClock size={14} /> Schedule
                            </button>
                          )}
                          {item.status === 'scheduled' && (
                            <button
                              className="primary-button"
                              disabled={actionId === item.id}
                              onClick={() => void performAction(item.id, 'start')}
                            >
                              <Play size={14} /> Start collection
                            </button>
                          )}
                          {item.status === 'in_progress' && (
                            <div className="collection-complete-action">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={weightValues[item.id] || ''}
                                onChange={event => setWeightValues(current => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))}
                                placeholder="Collected KG"
                                aria-label={`Actual collected weight in kilograms for ${item.customerName}`}
                              />
                              <button
                                className="primary-button"
                                disabled={actionId === item.id || !weightValues[item.id] || Number(weightValues[item.id]) <= 0}
                                onClick={() => void performAction(item.id, 'complete', Number(weightValues[item.id]))}
                              >
                                <Check size={14} /> Mark collected
                              </button>
                            </div>
                          )}
                          {['collected', 'verified'].includes(item.status) && (
                            <div className="collection-handover-action">
                              {!Object.prototype.hasOwnProperty.call(handoverFacilities, item.id) ? (
                                <button
                                  className="primary-button"
                                  disabled={handoverLoadingId === item.id}
                                  onClick={() => void loadHandoverFacilities(item.id)}
                                >
                                  {handoverLoadingId === item.id ? 'Loading facilities...' : 'Prepare handover'}
                                </button>
                              ) : (
                                <div className="handover-form">
                                  <label htmlFor={`handover-facility-${item.id}`}>
                                    Approved recycling facility
                                  </label>
                                  <select
                                    id={`handover-facility-${item.id}`}
                                    value={selectedFacilities[item.id] || ''}
                                    onChange={event => setSelectedFacilities(current => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))}
                                  >
                                    <option value="">Select facility</option>
                                    {(handoverFacilities[item.id] || []).map(facility => (
                                      <option key={facility.id} value={facility.id}>
                                        {facility.name} — {facility.facilityCode}
                                      </option>
                                    ))}
                                  </select>

                                  {(handoverFacilities[item.id] || []).length > 0 && (
                                    <>
                                      <label htmlFor={`handover-quantity-${item.id}`}>
                                        Handover quantity (KG)
                                      </label>
                                      <input
                                        id={`handover-quantity-${item.id}`}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={handoverQuantities[item.id] || ''}
                                        onChange={event => setHandoverQuantities(current => ({
                                          ...current,
                                          [item.id]: event.target.value,
                                        }))}
                                        placeholder="Enter quantity in KG"
                                      />
                                      <button
                                        className="primary-button"
                                        disabled={
                                          actionId === item.id ||
                                          !selectedFacilities[item.id] ||
                                          !handoverQuantities[item.id] ||
                                          Number(handoverQuantities[item.id]) <= 0
                                        }
                                        onClick={() => void submitWasteHandover(item)}
                                      >
                                        {actionId === item.id ? 'Recording...' : 'Record handover'}
                                      </button>
                                    </>
                                  )}

                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => {
                                      setHandoverFacilities(current => {
                                        const next = { ...current }
                                        delete next[item.id]
                                        return next
                                      })
                                    }}
                                  >
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default PSPWorkspace
