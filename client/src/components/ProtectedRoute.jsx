import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, fallback }) {
  const { status } = useAuth();
  if (status === "checking") {
    return <main className="auth-loading" aria-live="polite">Checking your session…</main>;
  }
  if (status === "error") return fallback;
  if (status !== "authenticated") return fallback;
  return children;
}
