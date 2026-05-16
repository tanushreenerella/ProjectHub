import { useState, useEffect } from "react";
import "./Landing.css";

interface LandingProps {
  onGetStarted: () => void;
  onLogin: () => void;
}
const FEATURES = [
  { icon: "🚀", title: "AI Assistant", desc: "Validate your startup idea with instant AI insights" },
  { icon: "🤝", title: "Find Team", desc: "Connect with students who match your skills" },
  { icon: "🎓", title: "Mentorship", desc: "Get guidance and feedback from experienced mentors" },
  { icon: "📋", title: "Workspace", desc: "Manage tasks, track progress, and collaborate easily" },
  { icon: "💰", title: "Funding", desc: "Explore funding options and check readiness score" },
  { icon: "💬", title: "Chat", desc: "Communicate with your team in real-time" }
];

const STUDENT_BENEFITS = [
  "Validate your idea",
  "Find co-founders",
  "Get mentorship"
];

const MENTOR_BENEFITS = [
  "Guide student founders",
  "Review real projects",
  "Build mentorship profile"
];

export default function Landing({ onGetStarted, onLogin }: LandingProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing">

      {/* Navbar */}
      <nav className={`landing-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span>🎓</span>
            <span className="landing-logo-text">projectHub</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#benefits">For Students</a>
            <a href="#mentors">For Mentors</a>
          </div>
          <div className="landing-nav-actions">
            <button className="l-btn-ghost" onClick={onLogin}>Sign In</button>
            <button className="l-btn-primary" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="l-hero">
        <div className="l-hero-glow" />
        <div className="l-hero-content">
          <div className="l-hero-badge">The Student Startup Platform</div>
          <h1 className="l-hero-headline">
  Build your startup.<br />
  <span className="l-hero-gradient">Find your team.</span>
</h1>

<p className="l-hero-sub">
  Everything you need to build, collaborate, and grow — in one platform.
</p>
          <div className="l-hero-actions">
            <button className="l-btn-primary l-btn-lg" onClick={onGetStarted}>Start Building for Free</button>
            <button className="l-btn-ghost l-btn-lg" onClick={onLogin}>I already have an account →</button>
          </div>

        </div>

        {/* Floating cards */}
        <div className="l-hero-visual">
          <div className="l-float-card l-fc-1">
            <span>📊</span>
            <div><strong>AI Score: 8/10</strong><p>Strong market fit</p></div>
          </div>
          <div className="l-float-card l-fc-2">
            <span>🤝</span>
            <div><strong>Team Match!</strong><p>React + ML dev found</p></div>
          </div>
          <div className="l-float-card l-fc-3">
            <span>🎓</span>
            <div><strong>Mentor Feedback</strong><p>4★ — Impressive MVP</p></div>
          </div>
          <div className="l-float-card l-fc-4">
            <span>💰</span>
            <div><strong>Funding Match</strong><p>3 grants available</p></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="l-section" id="features">
        <div className="l-section-label">What's inside</div>
        <h2 className="l-section-title">Everything your startup needs</h2>
        <p className="l-section-sub">One platform for idea validation, team building, project management, mentorship, and funding.</p>
        <div className="l-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="l-feature-card">
              <div className="l-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="l-section l-benefits-section" id="benefits">
        <div className="l-benefits-grid">
          <div className="l-benefits-col" id="students">
            <div className="l-badge l-badge-student">For Students</div>
            <h2>Launch your startup idea from campus</h2>
           <p>Build and grow your startup faster with the right tools and people.</p>
            <ul className="l-benefits-list">
              {STUDENT_BENEFITS.map(b => (
                <li key={b}><span className="l-check">✓</span>{b}</li>
              ))}
            </ul>
            <button className="l-btn-primary" onClick={onGetStarted}>Join as Student</button>
          </div>
          <div className="l-benefits-col" id="mentors">
            <div className="l-badge l-badge-mentor">For Mentors</div>
            <h2>Make a real impact on student founders</h2>
            <p>Share your experience, review real startup projects, and help ambitious students avoid the mistakes you've already made.</p>
            <ul className="l-benefits-list">
              {MENTOR_BENEFITS.map(b => (
                <li key={b}><span className="l-check l-check-mentor">✓</span>{b}</li>
              ))}
            </ul>
            <button className="l-btn-mentor" onClick={onGetStarted}>Join as Mentor</button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="l-section">
        <div className="l-section-label">Simple process</div>
        <h2 className="l-section-title">From idea to execution in 4 steps</h2>
        <div className="l-steps-grid">
          {[
  { n: "01", title: "Submit Idea", desc: "Get instant AI feedback" },
  { n: "02", title: "Find Team", desc: "Connect with collaborators" },
  { n: "03", title: "Get Mentor", desc: "Receive expert guidance" },
  { n: "04", title: "Launch", desc: "Build and grow your startup" }
].map(s => (
            <div key={s.n} className="l-step-card">
              <div className="l-step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="l-cta">
        <h2>Start your startup journey</h2>
<p>Join students building real projects.</p>
        <div className="l-cta-actions">
          <button className="l-btn-primary l-btn-lg" onClick={onGetStarted}>Create Free Account</button>
          <button className="l-btn-ghost l-btn-lg" onClick={onLogin}>Sign In</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="landing-logo">
            <span>🎓</span>
            <span className="landing-logo-text">projectHub</span>
          </div>
          <p>The student startup collaboration platform.</p>
          <p className="l-footer-copy">© 2026 projectHub. Built for student founders.</p>
        </div>
      </footer>
    </div>
  );
}