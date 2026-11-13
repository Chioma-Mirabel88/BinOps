import healthcareHeroImage from "./assets/binops-healthcare-hero.png";
import { useState } from 'react'
import api from './lib/api'
import { HeartPulse, Building2, ShieldCheck, RefreshCw } from 'lucide-react'

type HealthcareWorkspaceProps = {
  page: string
  organisationType: 'hospital' | 'pharmacy'
}

type RedemptionResponse = {
  message?: string
  error?: string
}

function HealthcareWorkspace({
  page,
  organisationType,
}: HealthcareWorkspaceProps) {
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const partnerName =
    organisationType === 'hospital' ? 'Hospital' : 'Pharmacy'

  async function handleRedemption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    const parsedAmount = Number(amount)

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId.trim())) {
      setError('Enter a valid Health Credit account UUID.')
      return
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Math.round(parsedAmount * 100) !== parsedAmount * 100) {
      setError('Enter a valid positive amount with no more than two decimal places.')
      return
    }

    if (description.length > 500) {
      setError('Description cannot exceed 500 characters.')
      return
    }

    setSubmitting(true)

    try {
      const idempotencyKey = crypto.randomUUID()

      const response = await api.post<RedemptionResponse>(
        '/healthcare/health-credits/redemptions',
        {
          accountId: accountId.trim(),
          amount: parsedAmount,
          idempotencyKey,
          ...(description.trim() ? { description: description.trim() } : {}),
        }
      )

      setNotice(response.data.message || 'Health Credits redeemed successfully.')
      setAccountId('')
      setAmount('')
      setDescription('')
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'The Health Credit redemption could not be completed.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-section">
      <div
        className="section-heading"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5,43,33,.94), rgba(5,43,33,.70)), url(${healthcareHeroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div>
          <h2>
            {page === 'Overview'
              ? `${partnerName} Operations Overview`
              : 'Health Credit Redemptions'}
          </h2>
          <p>
            {page === 'Overview'
              ? `Manage Health Credit redemption activities for your ${partnerName.toLowerCase()} organisation.`
              : 'Submit an authorised Health Credit redemption against a customer account.'}
          </p>
        </div>
      </div>

      <div className="stats-grid collection-stats">
        <article className="stat-card">
          <div className="stat-top">
            <span>Partner type</span>
            <Building2 size={19} />
          </div>
          <strong>{partnerName}</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Service</span>
            <HeartPulse size={19} />
          </div>
          <strong>Health Credits</strong>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>Access</span>
            <ShieldCheck size={19} />
          </div>
          <strong>Partner</strong>
        </article>
      </div>

      {error && <div className="panel" role="alert">{error}</div>}
      {notice && <div className="panel" role="status">{notice}</div>}

      <div className="panel collection-management-panel">
        <div className="panel-heading">
          <div>
            <h2>Redeem Health Credits</h2>
            <p>
              Enter the customer's Health Credit account ID and the amount
              authorised for redemption.
            </p>
          </div>
        </div>

        <div className="healthcare-redemption-intro">
          <div className="healthcare-redemption-icon">
            <HeartPulse size={22} />
          </div>
          <div>
            <h3>New redemption</h3>
            <p>Provide the customer's account details and the authorised amount.</p>
          </div>
        </div>

        <form className="healthcare-redemption-form" onSubmit={handleRedemption}>
          <div className="healthcare-form-field">
            <label htmlFor="health-account-id">Health Credit account ID</label>
            <input
              id="health-account-id"
              value={accountId}
              onChange={event => setAccountId(event.target.value)}
              placeholder="Enter customer account UUID"
              autoComplete="off"
              required
              disabled={submitting}
            />
            <small>Enter the account UUID supplied by the customer.</small>
          </div>

          <div className="healthcare-form-field">
            <label htmlFor="health-credit-amount">Redemption amount</label>
            <input
              id="health-credit-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              placeholder="0.00"
              required
              disabled={submitting}
            />
            <small>Use a positive amount with no more than two decimal places.</small>
          </div>

          <div className="healthcare-form-field healthcare-description-field">
            <label htmlFor="health-credit-description">
              Transaction description <span>(optional)</span>
            </label>
            <textarea
              id="health-credit-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Enter a service reference or brief description"
              maxLength={500}
              rows={3}
              disabled={submitting}
            />
            <small>{description.length}/500 characters</small>
          </div>

          <div className="healthcare-redemption-summary">
            <div>
              <span>Redemption amount</span>
              <strong>
                {amount && Number.isFinite(Number(amount)) && Number(amount) > 0
                  ? Number(amount).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
              </strong>
            </div>
            <span className="healthcare-summary-caption">
              Amount to be submitted for account validation
            </span>
          </div>

          <button
            type="submit"
            className="primary-button healthcare-submit-button"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="spin" />
                Processing redemption...
              </>
            ) : (
              'Submit redemption'
            )}
          </button>
        </form>

        <div className="healthcare-security-note">
          <ShieldCheck size={18} />
          <p>
            Every redemption is checked against account validity, available
            Health Credit balance and your organisation's authorisation.
            Successful transactions are recorded for audit purposes.
          </p>
        </div>
      </div>
    </div>
  )
}

export default HealthcareWorkspace
