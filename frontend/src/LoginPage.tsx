import registrationImage from "./assets/binops-landing-hero.png";
import { useState, type FormEvent } from "react";
import {
  Leaf, Mail, LockKeyhole, Eye, EyeOff,
  LoaderCircle, AlertCircle, User, Phone, Building2
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import api from "./lib/api";
import axios from "axios";
import "./LoginPage.css";

type AccountType = "individual" | "business" | "psp" | "recycler" | "healthcare";
type HealthcareType = "hospital" | "pharmacy";

export default function LoginPage({
  initialMode = "login",
  onBack,
}: {
  initialMode?: "login" | "register";
  onBack?: () => void;
}) {
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [healthcareType, setHealthcareType] = useState<HealthcareType>("hospital");
  const isOrganisationAccount = accountType !== "individual";
  const submittedAccountType = accountType === "healthcare" ? healthcareType : accountType;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (password.length < 12) {
        setError("Your password must contain at least 12 characters.");
        return;
      }
      if (isOrganisationAccount && organisationName.trim().length < 2) {
        setError("Please enter your organisation name.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const payload = {
          accountType: submittedAccountType,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          ...(isOrganisationAccount
            ? {
                organisationName: organisationName.trim(),
                serviceArea: serviceArea.trim() || undefined,
              }
            : {}),
        };

        await api.post("/auth/register", payload);
        setSuccess("Your account has been created. Signing you in...");
      }

      await login(email.trim(), password);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const response = err.response?.data;
        const fieldErrors = response?.details;
        const firstFieldError = fieldErrors
          ? Object.values(fieldErrors).flat().find(Boolean)
          : undefined;

        setError(
          firstFieldError ||
          response?.error ||
          response?.message ||
          (mode === "register"
            ? "Registration failed. Please review your details and try again."
            : "Login failed. Please check your credentials and try again.")
        );
      } else {
        setError("Unable to complete the request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section
        className="login-brand-panel"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(5,43,33,.72), rgba(5,43,33,.94)), url(${registrationImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="login-brand">
          <div className="login-brand-icon"><Leaf size={27} /></div>
          <div>
            <strong>BinOps</strong>
            <span>WASTE · HEALTH · TRUST</span>
          </div>
        </div>

        <div className="login-brand-message">
          <span className="login-eyebrow">A CLEANER, HEALTHIER FUTURE</span>
          <h1>Turning responsible waste management into community impact.</h1>
          <p>
            Coordinate waste collection, verify environmental contributions
            and connect sustainable action to healthcare rewards.
          </p>
        </div>

        <div className="login-brand-footer">
          <span>© 2026 BinOps</span>
          <span>Demonstration platform · Lagos, Nigeria</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-container">
          <div className="login-mobile-brand">
            <Leaf size={25} />
            <strong>BinOps</strong>
          </div>

          <div className="login-heading">
            <span>{mode === "register" ? "JOIN THE BINOPS ECOSYSTEM" : "WELCOME BACK"}</span>
            <h2>{mode === "register" ? "Create your account" : "Sign in to BinOps"}</h2>
            <p>
              {mode === "register"
                ? "Set up your account to access your BinOps workspace."
                : "Enter your account details to access your workspace."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {mode === "register" && (
              <>
                <label htmlFor="account-type">Account type</label>
                <select
                  id="account-type"
                  className="login-select"
                  value={accountType}
                  onChange={(event) => setAccountType(event.target.value as AccountType)}
                >
                  <option value="individual">Individual account</option>
                  <option value="business">Business account</option>
                  <option value="psp">PSP operator</option>
                  <option value="recycler">Recycler</option>
                  <option value="healthcare">Healthcare organisation</option>
                </select>

                <div className="login-field-grid">
                  <div>
                    <label htmlFor="register-first-name">First name</label>
                    <div className="login-input-wrapper">
                      <User size={18} />
                      <input
                        id="register-first-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        autoComplete="given-name"
                        placeholder="First name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="register-last-name">Last name</label>
                    <div className="login-input-wrapper">
                      <input
                        id="register-last-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        autoComplete="family-name"
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>
                </div>

                {accountType === "healthcare" && (
                  <>
                    <label htmlFor="healthcare-type">Healthcare organisation type</label>
                    <select
                      id="healthcare-type"
                      className="login-select"
                      value={healthcareType}
                      onChange={(event) => setHealthcareType(event.target.value as HealthcareType)}
                    >
                      <option value="hospital">Hospital</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  </>
                )}

                {isOrganisationAccount && (
                  <>
                    <label htmlFor="organisation-name">Organisation name</label>
                    <div className="login-input-wrapper">
                      <Building2 size={18} />
                      <input
                        id="organisation-name"
                        value={organisationName}
                        onChange={(event) => setOrganisationName(event.target.value)}
                        placeholder="Business or organisation name"
                        required
                      />
                    </div>

                    <label htmlFor="service-area">Service area (optional)</label>
                    <div className="login-input-wrapper">
                      <input
                        id="service-area"
                        value={serviceArea}
                        onChange={(event) => setServiceArea(event.target.value)}
                        placeholder="e.g. Ikeja"
                      />
                    </div>
                  </>
                )}

                <label htmlFor="register-phone">Phone number (optional)</label>
                <div className="login-input-wrapper">
                  <Phone size={18} />
                  <input
                    id="register-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="Phone number"
                  />
                </div>
              </>
            )}

            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrapper">
              <Mail size={18} />
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="login-password">Password</label>
            <div className="login-input-wrapper">
              <LockKeyhole size={18} />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "register" ? "At least 12 characters" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
                minLength={mode === "register" ? 12 : undefined}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {success && <div className="login-success" role="status">{success}</div>}

            {error && (
              <div className="login-error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle size={18} className="login-spinner" />
                  {mode === "register" ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                mode === "register" ? "Create account" : "Sign in to workspace"
              )}
            </button>
          </form>

          <p className="login-mode-switch">
            {mode === "register" ? "Already have an account?" : "New to BinOps?"}{" "}
            <button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>
              {mode === "register" ? "Sign in" : "Create an account"}
            </button>
          </p>

          {onBack && (
            <button type="button" className="login-back-button" onClick={onBack}>
              Back to home
            </button>
          )}

          <div className="login-security-note">
            <LockKeyhole size={15} />
            <span>Your account is protected by secure authentication.</span>
          </div>

          <p className="login-demo-note">
            BinOps graduation MVP · Local demonstration environment
          </p>
        </div>
      </section>
    </main>
  );
}
