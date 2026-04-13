import { useEffect, useState } from "react";
import type { User } from "../types/index.ts";
import "./Profile.css";

interface ProfileProps {
  user?: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
  const [profile, setProfile] = useState<any>(user || null);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("csh_token");
    if (!token) return;

    fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { if (!res.ok) throw new Error("Unauthorized"); return res.json(); })
      .then(async data => {
        const normalized: any = {
          id: data.id || data._id || "",
          name: data.name || "",
          email: data.email || "",
          role: data.role || "student",
          bio: data.bio || "",
          projects: data.projects || [],
          connections: data.connections || [],
          skills: data.skills || [],
          interests: data.interests || [],
          lookingFor: data.lookingFor || data.looking_for || []
        };

        try {
          const pRes = await fetch(`${import.meta.env.VITE_API_URL}/api/projects/my`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (pRes.ok) {
            const pj = await pRes.json();
            const formatted = (pj.projects || []).map((p: any) => ({
              id: p._id || p.id,
              title: p.title,
              description: p.description,
              category: p.category,
              stage: p.workspace_status || p.stage
            }));
            if (!normalized.projects.length || typeof normalized.projects[0] === "string") {
              normalized.projects = formatted;
            }
          }
        } catch {}

        setProfile(normalized);
        setBio(normalized.bio || "");
      })
      .catch(err => console.error(err));
  }, []);

  const saveBio = async () => {
    const token = localStorage.getItem("csh_token");
    setSaving(true);
    await fetch(`${import.meta.env.VITE_API_URL}/api/users/update-bio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bio })
    });
    setProfile((prev: any) => ({ ...prev, bio }));
    setEditingBio(false);
    setSaving(false);
  };

  if (!profile) return (
    <div className="profile-loading">
      <div className="profile-spinner" />
      <p>Loading profile...</p>
    </div>
  );

  const initials = profile.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="profile-page">

      {/* Header card */}
      <div className="profile-header-card">
        <div className="profile-avatar-lg">{initials}</div>
        <div className="profile-header-info">
          <div className="profile-name-row">
            <h2>{profile.name}</h2>
            <span className={`profile-role-badge ${profile.role}`}>{profile.role}</span>
          </div>
          <p className="profile-email">{profile.email}</p>

          {/* Bio */}
          {editingBio ? (
            <div className="profile-bio-edit">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell people about yourself — your role, skills, and what you're looking for."
                rows={3}
              />
              <div className="profile-bio-actions">
                <button className="p-btn-primary" onClick={saveBio} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button className="p-btn-ghost" onClick={() => { setEditingBio(false); setBio(profile.bio || ""); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-bio-view">
              <p className="profile-bio-text">{profile.bio || "No bio added yet — click Edit to add one."}</p>
              <button className="p-btn-ghost p-btn-sm" onClick={() => setEditingBio(true)}>Edit Bio</button>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="profile-stats-row">
        {[
          { label: "Projects", value: profile.projects?.length || 0 },
          { label: "Connections", value: profile.connections?.length || 0 },
          { label: "Skills", value: profile.skills?.length || 0 },
          { label: "Interests", value: profile.interests?.length || 0 }
        ].map(s => (
          <div key={s.label} className="profile-stat-card">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="profile-main-grid">

        {/* Left col */}
        <div className="profile-left-col">
          <div className="profile-card">
            <h3>Skills</h3>
            {profile.skills?.length
              ? <div className="profile-tags">{profile.skills.map((s: string) => <span key={s} className="p-tag p-tag-skill">{s}</span>)}</div>
              : <p className="p-empty">No skills added yet.</p>
            }
          </div>

          <div className="profile-card">
            <h3>Interests</h3>
            {profile.interests?.length
              ? <div className="profile-tags">{profile.interests.map((i: string) => <span key={i} className="p-tag p-tag-interest">{i}</span>)}</div>
              : <p className="p-empty">No interests added yet.</p>
            }
          </div>

          <div className="profile-card">
            <h3>Looking For</h3>
            {profile.lookingFor?.length
              ? <div className="profile-tags">{profile.lookingFor.map((l: string) => <span key={l} className="p-tag p-tag-looking">{l}</span>)}</div>
              : <p className="p-empty">Not specified.</p>
            }
          </div>
        </div>

        {/* Right col — Projects */}
        <div className="profile-right-col">
          <div className="profile-card profile-projects-card">
            <div className="profile-card-header">
              <h3>My Projects</h3>
              <span className="p-count">{profile.projects?.length || 0}</span>
            </div>
            {profile.projects?.length ? (
              <div className="profile-projects-list">
                {profile.projects.map((p: any) => (
                  <div key={p.id} className="profile-project-item">
                    <div className="profile-project-info">
                      <strong>{p.title}</strong>
                      <p>{p.description?.slice(0, 80)}{p.description?.length > 80 ? "..." : ""}</p>
                    </div>
                    {p.stage && (
                      <span className={`p-stage-badge stage-${p.stage}`}>{p.stage}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-empty">No projects yet. Create one from My Projects.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;