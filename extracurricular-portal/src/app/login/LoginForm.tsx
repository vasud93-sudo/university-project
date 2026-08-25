"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm({ demoMode, googleEnabled }: { demoMode: boolean; googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemoLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("demo", { email, redirect: false, callbackUrl: "/" });
    setLoading(false);
    if (res?.error) {
      setError("No account found for that email. Try one of the seeded demo accounts.");
    } else if (res?.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {googleEnabled && (
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 font-medium text-sm hover:bg-black/[.02] transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      )}

      {demoMode && (
        <div className={googleEnabled ? "pt-2 border-t border-border" : ""}>
          {googleEnabled && <p className="text-xs text-muted text-center my-4">or use a demo account</p>}
          <form onSubmit={handleDemoLogin} className="space-y-3">
            <input
              type="email"
              required
              placeholder="e.g. admin@fountainheadschools.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white rounded-xl py-2.5 font-medium text-sm hover:bg-primary-hover disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in with demo account"}
            </button>
          </form>
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
          <p className="text-xs text-muted mt-3 leading-relaxed">
            Demo mode — no password needed. Try{" "}
            <code className="bg-black/[.04] px-1 rounded">admin@fountainheadschools.org</code> (admin) or{" "}
            <code className="bg-black/[.04] px-1 rounded">aarav.mehta@fountainheadschools.org</code> (student).
          </p>
        </div>
      )}

      {!googleEnabled && !demoMode && (
        <p className="text-sm text-muted text-center">
          No sign-in method is configured. Set <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> or{" "}
          <code>DEMO_MODE=true</code> in your environment.
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
