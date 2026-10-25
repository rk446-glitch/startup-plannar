import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const { login, register, sessionError, refreshUser } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (mode === "register") {
        await register({ name, email, phone, password });
        setMode("login");
        setPassword("");
        setMessage("Registration successful. You can now log in.");
      } else {
        await login({ email, password });
      }
    } catch (requestError) {
      setError(requestError.message || "The request could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span className="brand-copy"><strong>Foundry</strong><small>STARTUP PLANNER</small></span>
        </div>
        <p className="eyebrow">YOUR BUSINESS, AT A GLANCE</p>
        <h1 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-description">
          {mode === "login"
            ? "Sign in to access your startup planning workspace."
            : "Register to create a private startup planning workspace."}
        </p>
        {sessionError && <p className="form-error" role="alert">{sessionError}</p>}
        {message && <p className="auth-success" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <div className="form-field">
              <label htmlFor="auth-name">Name</label>
              <input id="auth-name" autoComplete="name" value={name} maxLength="80" onChange={(event) => setName(event.target.value)} required />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} pattern="^[^@]+@gmail\.com$" title="Use a Gmail address ending in @gmail.com." required />
          </div>
          {mode === "register" && (
            <div className="form-field">
              <label htmlFor="auth-phone">Phone number</label>
              <input id="auth-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+14155552671" pattern="^\+[1-9][0-9]{7,14}$" title="Use international format, for example +14155552671." value={phone} onChange={(event) => setPhone(event.target.value)} required />
              <small>International format with country code, e.g. +14155552671.</small>
            </div>
          )}
          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength="8"
              maxLength="128"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {mode === "register" && <small>Use 8–128 characters.</small>}
          </div>
          <button className="calculate-button auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to Foundry?" : "Already have an account?"}{" "}
          <button
            className="auth-link"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setMessage("");
            }}
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
        {sessionError && (
          <button className="auth-retry" type="button" onClick={() => void refreshUser().catch(() => {})}>Retry session check</button>
        )}
      </section>
    </main>
  );
}
