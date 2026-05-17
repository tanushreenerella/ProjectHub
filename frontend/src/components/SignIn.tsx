import { useState, useEffect } from "react";
import "./SignIn.css";

declare global {
  interface Window {
    google?: any;
  }
}

interface SignInProps {
  onSignIn: (email: string, password: string) => void;
  onGoogleSignIn: (idToken: string) => void;
  onSwitchToRegister: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignIn, onGoogleSignIn, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSignIn(formData.email, formData.password);
    setLoading(false);
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) {
      alert("Google sign-in failed. Please try again.")
      return
    }
    setLoading(true)
    await onGoogleSignIn(response.credential)
    setLoading(false)
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          cancel_on_tap_outside: true,
        })
        setGoogleReady(true)
      }
    }
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="auth-page">
     <div className="auth-left">
  <div className="auth-left-inner">   {/* ADD THIS */}

    <div className="auth-brand">
      <span className="auth-brand-icon">🎓</span>
      <span className="auth-brand-name">projectHub</span>
    </div>

    <h1>
      Build. <span>Connect.</span> Grow.
    </h1>

    <p>
      A platform for student founders to build and collaborate.
    </p>

    <div className="auth-left-features">
      <div className="auth-feature">🚀 Validate ideas</div>
      <div className="auth-feature">🤝 Find your team</div>
      <div className="auth-feature">🎓 Get mentorship</div>
    </div>

  </div>
</div>
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Sign In</h2>
            <p>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            {/* Dummy inputs trick Chrome password manager into not autofilling real fields */}
            <input type="text" style={{ display: 'none' }} aria-hidden="true" />
            <input type="password" style={{ display: 'none' }} aria-hidden="true" />

            <div className="auth-field">
              <label>Email</label>
              <input type="text" name="email" value={formData.email}
                onChange={handleChange} placeholder="you@example.com"
                autoComplete="off" required />
            </div>

            <div className="auth-field">
              <label>
                <span>Password</span>
                <button type="button" className="auth-forgot">Forgot password?</button>
              </label>
              <input type="password" name="password" value={formData.password}
                onChange={handleChange} placeholder="Enter your password"
                autoComplete="off" required />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : "Sign In"}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <div className="auth-social">
            <button
              type="button"
              className="auth-social-btn"
              onClick={() => {
                if (!googleReady || !window.google?.accounts?.id) {
                  alert("Google sign-in is not ready yet. Please try again in a moment.")
                  return
                }
                window.google.accounts.id.prompt()
              }}
              disabled={!googleReady || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            <button type="button" className="auth-social-btn" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#e2e8f0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Continue with GitHub
            </button>
          </div>

          <p className="auth-switch">
            Don't have an account?{" "}
            <button onClick={onSwitchToRegister} className="auth-switch-link">Create one</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;