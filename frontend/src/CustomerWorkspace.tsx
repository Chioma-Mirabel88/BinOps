import { useEffect, useMemo, useState } from "react";
import {
  Recycle, Coins, Truck, MapPin, Clock3, Leaf, Building2,
  ArrowUpRight, RefreshCw, AlertCircle
} from "lucide-react";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";
import CollectionsPage from "./CollectionsPage";
import waterfrontImage from "./assets/binops-landing-hero.png";

type Collection = {
  id: string;
  serviceAddress?: string;
  serviceArea?: string;
  wasteCategory?: string;
  binFullness?: string;
  status?: string;
  requestedAt?: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
  pspOrganisationName?: string | null;
};

type CreditBalance = {
  accountId?: string;
  status?: string;
  availableCredits?: string | number;
};

type HealthcareDirectoryPartner = {
  id: string;
  name: string;
  organisationType: "hospital" | "pharmacy";
  serviceArea: string | null;
  contactPhone: string | null;
};

type Props = { page: string; onNavigate: (page: string) => void };

export default function CustomerWorkspace({ page, onNavigate }: Props) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [healthcarePartners, setHealthcarePartners] = useState<HealthcareDirectoryPartner[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryType, setDirectoryType] = useState<"all" | "hospital" | "pharmacy">("all");

  const customerName = useMemo(() => {
    const business = user?.organisations?.find(
      organisation => !["lawma_authority", "psp_operator"].includes(organisation.type)
    );
    return business?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Customer";
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    const results = await Promise.allSettled([
      api.get("/collections"),
      api.get("/health-credits/balance")
    ]);

    if (results[0].status === "fulfilled") {
      setCollections(results[0].value.data.collectionRequests || []);
    } else {
      setError("Collection information could not be loaded.");
    }

    if (results[1].status === "fulfilled") {
      setCredits(results[1].value.data.balance || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadHealthcareDirectory = async () => {
    setDirectoryLoading(true);
    setDirectoryError("");
    try {
      const response = await api.get("/healthcare/health-credits/directory");
      setHealthcarePartners(response.data.partners || []);
    } catch {
      setDirectoryError("Healthcare organisations could not be loaded. Please try again.");
    } finally {
      setDirectoryLoading(false);
    }
  };

  useEffect(() => {
    if (page === "Healthcare Partners") {
      void loadHealthcareDirectory();
    }
  }, [page]);

  const filteredHealthcarePartners = healthcarePartners.filter(partner => {
    const matchesType = directoryType === "all" || partner.organisationType === directoryType;
    const search = directorySearch.trim().toLowerCase();
    const matchesSearch = !search ||
      partner.name.toLowerCase().includes(search) ||
      (partner.serviceArea || "").toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });

  const completed = collections.filter(item =>
    ["collected", "verified"].includes((item.status || "").toLowerCase())
  ).length;

  const pspNames = [...new Set(
    collections.map(item => item.pspOrganisationName).filter(Boolean)
  )];

  const title = page === "Overview" ? `Welcome, ${customerName}`
    : page === "Collection Requests" ? "Collection requests"
    : page === "Payments & Renewal" ? "Payments & renewal"
    : page === "History & Receipts" ? "History & receipts"
    : page === "Waste Impact" ? "Your waste impact"
    : page;

  const showCollectionList = [
    "Overview", "Collection Requests", "History & Receipts"
  ].includes(page);

  // Reuse the existing customer collection workflow and API integration.
  if (page === "Collection Requests") {
    return <CollectionsPage />;
  }

  return (
    <div className="customer-workspace">
      <section
        className="customer-welcome"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5,43,33,.94) 0%, rgba(5,43,33,.78) 48%, rgba(5,43,33,.22) 100%), url(${waterfrontImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div>
          <span className="landing-eyebrow">YOUR BINOPS WORKSPACE</span>
          <h1>{title}</h1>
          <p>
            {page === "Overview"
              ? "Keep track of your waste services, collection activity and Health Credits."
              : "Your personal record of activity across the BinOps ecosystem."}
          </p>
        </div>
        <button className="customer-refresh" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </section>

      {page === "Overview" && (
        <>
          <section className="customer-highlight">
            <div className="customer-highlight-icon"><Leaf size={25} /></div>
            <div><strong>Just Bin it. Live healthier.</strong><span>Responsible waste management connects to cleaner surroundings and healthier communities.</span></div>
          </section>

          <section className="customer-summary-grid">
            <article>
              <span>Bin Status</span>
              <strong className="customer-small-value">
                {loading ? "—" : collections[0]?.binFullness || "Not recorded"}
              </strong>
              <Recycle />
            </article>
            <article>
              <span>Collections</span>
              <strong>{loading ? "—" : collections.length}</strong>
              <Truck />
            </article>
            <article>
              <span>Waste Impact</span>
              <strong>{loading ? "—" : completed}</strong>
              <small>Completed / verified</small>
              <Leaf />
            </article>
            <article>
              <span>Health Credits</span>
              <strong>{loading ? "—" : credits ? Number(credits.availableCredits || 0).toLocaleString() : "—"}</strong>
              <Coins />
            </article>
          </section>
        </>
      )}

      {page === "My Health Credits" && (
        <section className="customer-detail-card">
          <div className="customer-detail-icon"><Coins /></div>
          <span>AVAILABLE HEALTH CREDITS</span>
          <strong>{loading ? "Loading..." : credits ? Number(credits.availableCredits || 0).toLocaleString() : "Account not available"}</strong>
          <p>Health Credits are non-cash, non-transferable credits intended for redemption with approved healthcare partners. They are not cash or an investment.</p>
          {credits?.status && <small>Account status: {credits.status}</small>}
        </section>
      )}

      {page === "My PSP" && (
        <section className="customer-directory-card">
          <Truck size={26} />
          <h2>Your collection operator</h2>
          {pspNames.length ? pspNames.map(name => <p key={name}>{name}</p>) : <p>No PSP assignment is available in your current collection records.</p>}
          <small>Operator information is shown from your existing collection records.</small>
        </section>
      )}

      {page === "Healthcare Partners" && (
        <section className="healthcare-directory">
          <div className="healthcare-directory-heading">
            <div>
              <Building2 size={27} />
              <h2>Hospitals and pharmacies</h2>
              <p>Browse active healthcare organisations listed on BinOps.</p>
            </div>
            <button onClick={() => void loadHealthcareDirectory()} disabled={directoryLoading}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div className="healthcare-directory-controls">
            <input
              type="search"
              value={directorySearch}
              onChange={event => setDirectorySearch(event.target.value)}
              placeholder="Search by organisation or service area"
              aria-label="Search healthcare organisations"
            />
            <select
              value={directoryType}
              onChange={event => setDirectoryType(event.target.value as "all" | "hospital" | "pharmacy")}
              aria-label="Filter by organisation type"
            >
              <option value="all">All organisations</option>
              <option value="hospital">Hospitals</option>
              <option value="pharmacy">Pharmacies</option>
            </select>
          </div>

          <div className="healthcare-directory-notice">
            Health Credit participation is not confirmed by directory listing. Contact the organisation
            directly before visiting to confirm whether it accepts BinOps Health Credits.
          </div>

          {directoryError && <div className="customer-error"><AlertCircle size={16} />{directoryError}</div>}
          {directoryLoading ? (
            <p className="customer-empty">Loading healthcare organisations...</p>
          ) : filteredHealthcarePartners.length === 0 ? (
            <p className="customer-empty">
              {healthcarePartners.length === 0
                ? "No active hospitals or pharmacies are currently listed."
                : "No organisations match your search."}
            </p>
          ) : (
            <div className="healthcare-directory-grid">
              {filteredHealthcarePartners.map(partner => (
                <article className="healthcare-directory-item" key={partner.id}>
                  <div className="healthcare-directory-item-icon"><Building2 size={21} /></div>
                  <div className="healthcare-directory-item-content">
                    <span className="healthcare-directory-type">
                      {partner.organisationType === "hospital" ? "Hospital" : "Pharmacy"}
                    </span>
                    <h3>{partner.name}</h3>
                    <p><MapPin size={14} /> {partner.serviceArea || "Service area not provided"}</p>
                    {partner.contactPhone ? (
                      <p><strong>Contact:</strong> <a href={"tel:" + partner.contactPhone}>{partner.contactPhone}</a></p>
                    ) : (
                      <p>Contact number not provided</p>
                    )}
                    <small>Participation not confirmed</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {page === "Recyclers" && (
        <section className="customer-directory-card">
          <Recycle size={27} />
          <h2>Recycling facilities</h2>
          <p>Recycling facilities receive and process eligible materials after collection handover.</p>
          <small>The recycler directory is not yet connected to a backend listing. Facility listings will appear when that service is available.</small>
        </section>
      )}

      {page === "Payments & Renewal" && (
        <section className="customer-directory-card">
          <Coins size={27} />
          <h2>Payments and service renewal</h2>
          <p>Your collection service payment history and renewal options will be displayed here when the payment service is connected.</p>
          <small>No payment has been initiated or processed by this demonstration screen.</small>
        </section>
      )}

      {page === "Waste Impact" && (
        <section className="customer-directory-card">
          <Leaf size={27} />
          <h2>Your recorded environmental activity</h2>
          <p>{loading ? "Loading collection records..." : `${completed} collection record(s) currently marked collected or verified.`}</p>
          <small>This is a count of recorded collection statuses, not a calculated recycling or carbon-impact figure.</small>
        </section>
      )}

      {page === "My Account" && (
        <section className="customer-directory-card">
          <Building2 size={27} />
          <h2>Account details</h2>
          <p><strong>{customerName}</strong></p>
          <p>{user?.email}</p>
          <p>{user?.phone || "No phone number on profile"}</p>
          <small>Identity is taken from your authenticated BinOps profile.</small>
        </section>
      )}

      {showCollectionList && (
        <section className="customer-activity-panel">
          <div className="customer-panel-heading">
            <div><h2>{page === "Overview" ? "Recent collection activity" : page}</h2><p>Information retrieved from your customer collection records.</p></div>
            {page === "Overview" && <span>{collections.length} record(s)</span>}
          </div>

          {error && <div className="customer-error"><AlertCircle size={16} />{error}</div>}
          {loading ? <p className="customer-empty">Loading your collection records...</p>
            : collections.length === 0 ? <p className="customer-empty">No collection requests have been recorded yet.</p>
            : <div className="customer-collection-list">
              {collections.map(item => (
                <article key={item.id}>
                  <div className="customer-collection-icon"><Recycle size={19} /></div>
                  <div className="customer-collection-main">
                    <strong>{item.wasteCategory || "Waste collection"}</strong>
                    <span><MapPin size={13} /> {item.serviceArea || item.serviceAddress || "Service location not provided"}</span>
                    <small>{item.requestedAt ? new Date(item.requestedAt).toLocaleDateString() : "Date unavailable"}</small>
                  </div>
                  <span className={`customer-status customer-status-${(item.status || "unknown").toLowerCase().replace(/_/g, "-")}`}>
                    {(item.status || "Unknown").replace(/_/g, " ")}
                  </span>
                </article>
              ))}
            </div>
          }
        </section>
      )}

      {page === "Overview" && (
        <section className="customer-next-step">
          <div><Clock3 size={20} /><span>Keep your collection information up to date and check your request history for service progress.</span></div>
          <button onClick={() => onNavigate("Collection Requests")}>
            Collection services <ArrowUpRight size={16} />
          </button>
        </section>
      )}
    </div>
  );
}
