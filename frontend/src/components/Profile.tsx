import { useEffect, useState } from "react";
import "./Profile.css";

interface ProfileProps {
  user?: any;
}

const Profile: React.FC<ProfileProps> = () => {
  const [profile, setProfile] = useState<any>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState("");
  useEffect(() => {
  const token = localStorage.getItem("csh_token");

  if (!token) {
    console.log("No token yet, waiting...");
    return;
  }

  fetch(`http://127.0.0.1:5000/api/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    })
    .then(async data => {
      // normalize user shape and ensure arrays exist
      const normalized: any = {
        id: data.id || data._id || data.user_id || '',
        name: data.name || data.full_name || data.displayName || '',
        email: data.email || data.user_email || '',
        role: data.role || 'student',
        bio: data.bio || '',
        projects: data.projects || data.user_projects || [],
        connections: data.connections || data.connection_ids || [],
        skills: data.skills || data.skills_list || [],
        interests: data.interests || data.interests_list || [],
        lookingFor: data.lookingFor || data.looking_for || []
      };

      // If projects are only ids, try to fetch full project objects
      try {
        const token = localStorage.getItem('csh_token');
        if (token) {
          const res = await fetch('http://127.0.0.1:5000/api/projects/my', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const pj = await res.json();
            const formatted = (pj.projects || []).map((p: any) => ({
              id: p._id || p.id,
              title: p.title,
              description: p.description,
              category: p.category,
              stage: p.stage,
              skillsNeeded: p.skills_required || p.skillsNeeded || [],
              createdAt: p.created_at ? new Date(p.created_at) : (p.createdAt ? new Date(p.createdAt) : new Date())
            }));
            // If normalized.projects is empty or contains ids, replace with fetched projects
            if (!normalized.projects.length || typeof normalized.projects[0] === 'string') {
              normalized.projects = formatted;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch projects for profile', err);
      }

      setProfile(normalized);
      setBio(normalized.bio || "");
    })
    .catch(err => console.error(err));
}, []);
  const saveBio = async () => {
    const token = localStorage.getItem("csh_token");

    await fetch("http://127.0.0.1:5000/api/users/update-bio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bio }),
    });

    // update UI immediately
    setProfile((prev: any) => ({ ...prev, bio }));
    setEditingBio(false);
  };

  if (!profile) return <div className="loading">Loading profile...</div>;

  return (
    <div className="profile-container">

      {/* HEADER */}
      <div className="profile-header">
        <div className="avatar">
          {profile.name?.charAt(0).toUpperCase()}
        </div>

        <div className="profile-info">
          <h2>{profile.name}</h2>
          <p>{profile.email}</p>
          <span className="role">{profile.role}</span>

          <div className="bio">
            {editingBio ? (
              <div className="bio-edit">
                <textarea
                  className="bio-textarea"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself — your role, skills, and what you're looking for."
                  rows={4}
                />
                <div className="bio-actions">
                  <button className="btn save" onClick={saveBio}>Save</button>
                  <button className="btn cancel" onClick={() => { setEditingBio(false); setBio(profile.bio || ''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="bio-view">
                <p className="bio-text">{profile.bio || "No bio added yet"}</p>
                <button className="btn edit" onClick={() => setEditingBio(true)}>
                  Edit Bio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stat">
          <h3>{profile.projects?.length || 0}</h3>
          <p>Projects</p>
        </div>

        <div className="stat">
          <h3>{profile.connections?.length || 0}</h3>
          <p>Connections</p>
        </div>

        <div className="stat">
          <h3>{profile.skills?.length || 0}</h3>
          <p>Skills</p>
        </div>

        <div className="stat">
          <h3>{profile.interests?.length || 0}</h3>
          <p>Interests</p>
        </div>
      </div>

      <div className="profile-grid">

        {/* SKILLS */}
        <div className="card">
          <h3>Skills</h3>
          <div className="tags">
            {profile.skills?.map((s: string) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>

        {/* INTERESTS */}
        <div className="card">
          <h3>Interests</h3>
          <div className="tags">
            {profile.interests?.map((i: string) => (
              <span key={i}>{i}</span>
            ))}
          </div>
        </div>

        {/* LOOKING FOR */}
        <div className="card">
          <h3>Looking For</h3>
          <div className="tags">
            {profile.lookingFor?.map((l: string) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        {/* RECENT PROJECTS */}
        <div className="card wide">
          <h3>Recent Projects</h3>
          {profile.projects?.length ? (
            profile.projects.map((p: any) => (
              <div className="project" key={p.id}>
                <h4>{p.title}</h4>
                <p>{p.description}</p>
              </div>
            ))
          ) : (
            <p>No projects yet</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default Profile;
