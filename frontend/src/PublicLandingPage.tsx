import { useState } from "react";
import landingHeroImage from "./assets/binops-landing-hero.png";
import {
  Leaf, Recycle, HeartPulse, ShieldCheck, ArrowRight,
  Menu, X, LogIn, UserPlus, Building2, Truck
} from "lucide-react";

type Props = {
  onLogin: () => void;
  onRegister: () => void;
  onWorkspace: () => void;
  isAuthenticated: boolean;
};

export default function PublicLandingPage({ onLogin, onRegister, onWorkspace, isAuthenticated }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#home" aria-label="BinOps home">
          <span className="landing-brand-mark"><Leaf size={23} /></span>
          <span><strong>BinOps</strong><small>WASTE · HEALTH · TRUST</small></span>
        </a>

        <button
          className="landing-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={`landing-nav ${menuOpen ? "landing-nav-open" : ""}`}>
          <button onClick={() => goTo("home")}>Home</button>
          <button onClick={() => goTo("how-it-works")}>How it works</button>
          <button onClick={() => goTo("ecosystem")}>Our ecosystem</button>
          <button onClick={() => goTo("about")}>About</button>
        </nav>

        <div className="landing-auth-actions">
          {isAuthenticated ? (
            <button className="landing-auth-login" onClick={onWorkspace}>
              <LogIn size={16} />
              <span>Access workspace</span>
            </button>
          ) : (
            <button className="landing-auth-login" onClick={onLogin}>
              <LogIn size={16} />
              <span>Sign in</span>
            </button>
          )}
          <button className="landing-auth-register" onClick={onRegister}>
            <UserPlus size={16} />
            <span>Create account</span>
          </button>
        </div>
      </header>

      <section className="landing-hero" id="home">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">A CLEANER ENVIRONMENT. HEALTHIER COMMUNITIES.</span>
          <h1>Just Bin it.<br /><em>Live healthier.</em></h1>
          <p>
            Make responsible waste management count. BinOps connects
            collection services, environmental impact and healthcare
            rewards in one coordinated ecosystem.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-primary" onClick={onRegister}>
              Create your account <ArrowRight size={17} />
            </button>
            <button className="landing-secondary" onClick={onLogin}>
              Sign in to BinOps
            </button>
          </div>
          <button className="landing-discover-link" onClick={() => goTo("how-it-works")}>
            Discover how BinOps works
          </button>
          <div className="landing-trust-line">
            <ShieldCheck size={17} />
            <span>Transparent collection records · Blockchain-backed proofs</span>
          </div>
        </div>
        <div className="landing-hero-art">
          <img
            className="landing-hero-photo"
            src={landingHeroImage}
            alt="Sustainable waste management and a cleaner environment"
          />
        </div>
      </section>

      <section className="landing-intro" id="about">
        <span className="landing-eyebrow">THE BINOPS ECOSYSTEM</span>
        <h2>Waste action with a wider purpose.</h2>
        <p>
          BinOps brings customers, waste collection operators, recycling
          facilities and healthcare partners into a connected service
          ecosystem — making responsible waste management easier to
          coordinate and its impact easier to track.
        </p>
      </section>

      <section className="landing-feature-section" id="ecosystem">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">ONE CONNECTED PLATFORM</span>
          <h2>More than waste collection.</h2>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card">
            <span className="landing-feature-icon"><Truck /></span>
            <h3>Waste collection</h3>
            <p>Connect customers with participating collection operators and follow service requests.</p>
          </article>
          <article className="landing-feature-card">
            <span className="landing-feature-icon"><Recycle /></span>
            <h3>Environmental impact</h3>
            <p>Record collection and receiving-facility handovers to support transparent waste recovery reporting.</p>
          </article>
          <article className="landing-feature-card">
            <span className="landing-feature-icon"><HeartPulse /></span>
            <h3>Health Credits</h3>
            <p>Recognise eligible environmental participation with non-cash credits for approved healthcare services.</p>
          </article>
          <article className="landing-feature-card">
            <span className="landing-feature-icon"><ShieldCheck /></span>
            <h3>Trusted records</h3>
            <p>Use selective blockchain-backed proofs to strengthen the integrity of recorded collection events.</p>
          </article>
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div>
          <span className="landing-eyebrow">HOW IT WORKS</span>
          <h2>Small actions.<br />Connected outcomes.</h2>
          <p>From a collection request to a verified handover, each stage contributes to a clearer picture of environmental action.</p>
        </div>
        <div className="landing-steps">
          <article><b>01</b><div><h3>Request a collection</h3><p>Customers submit waste collection requests through their workspace.</p></div></article>
          <article><b>02</b><div><h3>Collect and hand over</h3><p>Participating operators record collection and receiving-facility handover details.</p></div></article>
          <article><b>03</b><div><h3>Verify and recognise</h3><p>Recorded evidence supports oversight verification and eligible Health Credit rewards.</p></div></article>
        </div>
      </section>

      <section className="landing-partners">
        <span className="landing-eyebrow">A SHARED RESPONSIBILITY</span>
        <h2>Built around collaboration.</h2>
        <div className="landing-partner-types">
          <span><UsersIcon /> Customers</span>
          <span><Truck /> Collection operators</span>
          <span><Recycle /> Recycling facilities</span>
          <span><Building2 /> Healthcare partners</span>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-eyebrow">START WITH YOUR BINOPS WORKSPACE</span>
          <h2>Make every collection count.</h2>
        </div>
        <div className="landing-cta-actions">
          <button className="landing-primary" onClick={onRegister}>
            Create account <ArrowRight size={17} />
          </button>
          <button className="landing-secondary" onClick={onLogin}>
            Sign in
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#home">
          <span className="landing-brand-mark"><Leaf size={21} /></span>
          <span><strong>BinOps</strong><small>WASTE · HEALTH · TRUST</small></span>
        </a>
        <span>© 2026 BinOps · Demonstration platform · Lagos, Nigeria</span>
        <span>Cleaner communities, healthier lives.</span>
      </footer>
    </main>
  );
}

function UsersIcon() {
  return <Building2 />;
}
