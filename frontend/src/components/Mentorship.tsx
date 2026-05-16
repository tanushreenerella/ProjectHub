import { useEffect, useState } from "react";
import "./Mentorship.css";

interface MentorUser {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  interests: string[];
  bio: string;
  mentee_count?: number;
  feedback?: FeedbackItem[];
  projects?: StudentProject[];
  feedback_given?: FeedbackItem[];
}

interface FeedbackItem {
  id: string;
  mentor_id: string;
  student_id: string;
  project_id: string;
  project_title: string;
  feedback: string;
  rating: number | null;
  mentor_name: string;
  created_at: string;
}

interface StudentProject {
  id: string;
  title: string;
  description: string;
  category: string;
  stage: string;
}

interface PendingRequest {
  id: string;
  student_id?: string;
  mentor_id?: string;
  student_name?: string;
  mentor_name?: string;
  student_bio?: string;
  student_skills?: string[];
  message: string;
  status: string;
  created_at: string;
}

interface Props {
  userRole: string;
  userId?: string;
}

const API = import.meta.env.VITE_API_URL;

export default function Mentorship({ userRole }: Props) {
  const token = localStorage.getItem("csh_token");
  const normalizedRole = String(userRole || "").trim().toLowerCase();
  const isMentor = normalizedRole === "mentor";

  // Shared
  const [activeTab, setActiveTab] = useState(isMentor ? "students" : "my-mentors");
  const [loadError, setLoadError] = useState("");

  // Mentor state
  const [myStudents, setMyStudents] = useState<MentorUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [allStudents, setAllStudents] = useState<MentorUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<MentorUser | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackProject, setFeedbackProject] = useState("");
  const [feedbackProjectTitle, setFeedbackProjectTitle] = useState("General");
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");

  // Student state
  const [allMentors, setAllMentors] = useState<MentorUser[]>([]);
  const [myMentors, setMyMentors] = useState<MentorUser[]>([]);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [studentPending, setStudentPending] = useState<PendingRequest[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<MentorUser | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing authentication token.");
      setLoading(false);
      return;
    }

    setLoadError("");
    setActiveTab(isMentor ? "students" : "my-mentors");
    if (isMentor) {
      loadMentorData();
    } else {
      loadStudentData();
    }
  }, [isMentor, token]);

  const loadMentorData = async () => {
    setLoading(true);
    try {
      const [res, studentsRes] = await Promise.all([
        fetch(`${API}/api/mentorship/my-students`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/mentorship/students`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const data = await res.json();
      const studentsData = await studentsRes.json();

      setMyStudents(data.students || []);
      setPendingRequests(data.pending_requests || []);
      if (!studentsRes.ok) {
        console.error("Failed to load students", studentsData);
        setAllStudents([]);
      } else {
        setAllStudents(studentsData.students || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError("Unable to load mentor/students data. Please refresh the page.");
      setAllStudents([]);
    }
    setLoading(false);
  };

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const [mentorsRes, myRes] = await Promise.all([
        fetch(`${API}/api/mentorship/mentors`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/mentorship/my-mentors`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const mentorsData = await mentorsRes.json();
      const myData = await myRes.json();

      if (!mentorsRes.ok) {
        console.error("Failed to load mentors", mentorsData);
        setAllMentors([]);
      } else {
        setAllMentors(mentorsData.mentors || []);
      }

      if (!myRes.ok) {
        console.error("Failed to load student mentorship data", myData);
        setMyMentors([]);
        setAllFeedback([]);
        setStudentPending([]);
      } else {
        setMyMentors(myData.mentors || []);
        setAllFeedback(myData.all_feedback || []);
        setStudentPending(myData.pending_requests || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError("Unable to load mentorship data. Please refresh the page.");
    }
    setLoading(false);
  };

  const handleRespondToRequest = async (requestId: string, action: "accept" | "reject") => {
    try {
      await fetch(`${API}/api/mentorship/request/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action })
      });
      loadMentorData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedMentor || !requestMessage.trim()) return;
    setRequestLoading(true);
    try {
      const res = await fetch(`${API}/api/mentorship/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mentor_id: selectedMentor.id, message: requestMessage })
      });
      const data = await res.json();
      if (res.ok) {
        setRequestSuccess("Request sent successfully!");
        setRequestMessage("");
        setTimeout(() => { setSelectedMentor(null); setRequestSuccess(""); loadStudentData(); }, 1500);
      } else {
        setRequestSuccess(data.error || "Failed to send request");
      }
    } catch (e) {
      setRequestSuccess("Failed to send request");
    }
    setRequestLoading(false);
  };

  const handleLeaveFeedback = async () => {
    if (!selectedStudent || !feedbackText.trim()) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(`${API}/api/mentorship/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          project_id: feedbackProject,
          project_title: feedbackProjectTitle,
          feedback: feedbackText,
          rating: feedbackRating
        })
      });
      if (res.ok) {
        setFeedbackSuccess("Feedback sent!");
        setFeedbackText("");
        setFeedbackRating(5);
        setTimeout(() => { setFeedbackSuccess(""); loadMentorData(); }, 1500);
      }
    } catch (e) {
      console.error(e);
    }
    setFeedbackLoading(false);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const date = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    const now = Date.now();
    const diff = Math.floor((now - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 172800) return "yesterday";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const totalFeedbackGiven = myStudents.reduce((sum, student) => sum + (student.feedback_given?.length || 0), 0);
  const totalStudentProjects = myStudents.reduce((sum, student) => sum + (student.projects?.length || 0), 0);
  const latestMentorAdvice = [...myStudents.flatMap(student => student.feedback_given || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const mentorsWithFeedback = myMentors.filter(m => m.feedback && m.feedback.length > 0).length;
  const latestStudentFeedback = [...allFeedback]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  // ── MENTOR VIEW ──
  if (isMentor) {
    return (
      <div className="mentorship-page">
        <div className="mentorship-header">
          <div>
            <h1>Mentor Dashboard</h1>
            <p>Guide student founders and help them build better startups.</p>
          </div>
          <div className="mentorship-stats">
            <div className="m-stat"><strong>{myStudents.length}</strong><span>Students</span></div>
            <div className="m-stat"><strong>{pendingRequests.length}</strong><span>Pending</span></div>
          </div>
        </div>

        <div className="m-impact-grid">
          <div className="m-impact-card">
            <strong>{totalFeedbackGiven}</strong>
            <span>Mentor reviews shared</span>
          </div>
          <div className="m-impact-card">
            <strong>{totalStudentProjects}</strong>
            <span>Student projects reviewed</span>
          </div>
          <div className="m-impact-card">
            <strong>{myStudents.length}</strong>
            <span>Active students</span>
          </div>
        </div>
        {latestMentorAdvice && (
          <div className="m-impact-note">
            <strong>Latest mentor guidance:</strong>
            <p>“{latestMentorAdvice.feedback.slice(0, 120)}{latestMentorAdvice.feedback.length > 120 ? '...' : ''}”</p>
          </div>
        )}

        <div className="mentorship-tabs">
          {[
            { id: "students", label: `My Students (${myStudents.length})` },
            { id: "requests", label: `Requests (${pendingRequests.length})` },
            { id: "find-students", label: `Find Students (${allStudents.length})` }
          ].map(t => (
            <button key={t.id} className={`m-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {loading ? <p className="m-loading">Loading...</p> : (
          <>
            {/* Pending Requests */}
            {activeTab === "requests" && (
              <div className="m-section">
                {pendingRequests.length === 0
                  ? <div className="m-empty"><p>No pending mentorship requests.</p></div>
                  : pendingRequests.map(req => (
                    <div key={req.id} className="m-request-card">
                      <div className="m-request-info">
                        <div className="m-avatar">{req.student_name?.charAt(0).toUpperCase()}</div>
                        <div>
                          <strong>{req.student_name}</strong>
                          <p className="m-bio">{req.student_bio || "No bio provided"}</p>
                          {req.student_skills && req.student_skills.length > 0 && (
                            <div className="m-tags">
                              {req.student_skills.slice(0, 3).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                            </div>
                          )}
                          {req.message && <p className="m-message">"{req.message}"</p>}
                          <span className="m-date">{formatDate(req.created_at)}</span>
                        </div>
                      </div>
                      <div className="m-request-actions">
                        <button className="m-btn-accept" onClick={() => handleRespondToRequest(req.id, "accept")}>
                          Accept
                        </button>
                        <button className="m-btn-reject" onClick={() => handleRespondToRequest(req.id, "reject")}>
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* My Students */}
            {activeTab === "students" && (
              <div className="m-section">
                {myStudents.length === 0
                  ? <div className="m-empty"><p>No students yet. Accept requests to start mentoring.</p></div>
                  : (
                    <div className="m-students-grid">
                      {myStudents.map(student => (
                        <div key={student.id} className="m-student-card">
                          <div className="m-student-header">
                            <div className="m-avatar">{student.name.charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{student.name}</strong>
                              <p>{student.bio || "No bio"}</p>
                            </div>
                          </div>

                          {student.skills.length > 0 && (
                            <div className="m-tags">
                              {student.skills.slice(0, 4).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                            </div>
                          )}

                          {student.projects && student.projects.length > 0 && (
                            <div className="m-projects">
                              <p className="m-section-label">Projects</p>
                              {student.projects.map(p => (
                                <div key={p.id} className="m-project-item">
                                  <strong>{p.title}</strong>
                                  <p>{p.description?.slice(0, 60)}{p.description?.length > 60 ? "..." : ""}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {student.feedback_given && student.feedback_given.length > 0 && (
                            <div className="m-feedback-history">
                              <p className="m-section-label">Recent Feedback Given</p>
                              {student.feedback_given.slice(0, 2).map(f => (
                                <div key={f.id} className="m-feedback-item">
                                  <span className="m-feedback-project">{f.project_title}</span>
                                  <p>{f.feedback.slice(0, 80)}{f.feedback.length > 80 ? "..." : ""}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <button className="m-btn-feedback"
                            onClick={() => { setSelectedStudent(student); setFeedbackProject(""); setFeedbackProjectTitle("General"); }}>
                            Leave Feedback
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Find Students */}
            {activeTab === "find-students" && (
              <div className="m-section">
                {allStudents.length === 0
                  ? <div className="m-empty"><p>{loadError || "No students available yet."}</p></div>
                  : (
                    <div className="m-students-grid">
                      {allStudents.map(student => (
                        <div key={student.id} className="m-student-card">
                          <div className="m-student-header">
                            <div className="m-avatar">{student.name.charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{student.name}</strong>
                              <p>{student.bio || "No bio"}</p>
                            </div>
                          </div>

                          {student.skills.length > 0 && (
                            <div className="m-tags">
                              {student.skills.slice(0, 4).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                            </div>
                          )}

                          {student.interests.length > 0 && (
                            <div className="m-tags">
                              {student.interests.slice(0, 4).map(i => <span key={i} className="m-interest-tag">{i}</span>)}
                            </div>
                          )}

                          <div className="m-student-meta">
                            <span>{student.projects?.length || 0} project{student.projects?.length === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* Feedback Modal */}
        {selectedStudent && (
          <div className="m-modal-overlay" onClick={() => setSelectedStudent(null)}>
            <div className="m-modal" onClick={e => e.stopPropagation()}>
              <div className="m-modal-header">
                <div>
                  <h3>Leave Feedback</h3>
                  <p>For {selectedStudent.name}</p>
                </div>
                <button className="m-close" onClick={() => setSelectedStudent(null)}>×</button>
              </div>

              <div className="m-modal-body">
                {selectedStudent.projects && selectedStudent.projects.length > 0 && (
                  <div className="m-field">
                    <label>Project (optional)</label>
                    <select value={feedbackProject} onChange={e => {
                      const proj = selectedStudent.projects?.find(p => p.id === e.target.value);
                      setFeedbackProject(e.target.value);
                      setFeedbackProjectTitle(proj?.title || "General");
                    }}>
                      <option value="">General Feedback</option>
                      {selectedStudent.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="m-field">
                  <label>Rating</label>
                  <div className="m-rating">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} className={`m-star ${feedbackRating >= n ? "active" : ""}`}
                        onClick={() => setFeedbackRating(n)}>★</button>
                    ))}
                    <span>{feedbackRating}/5</span>
                  </div>
                </div>

                <div className="m-field">
                  <label>Feedback *</label>
                  <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                    placeholder="Share specific, actionable advice for this student..."
                    rows={5} />
                </div>

                {feedbackSuccess && <p className="m-success">{feedbackSuccess}</p>}

                <div className="m-modal-actions">
                  <button className="m-btn-secondary" onClick={() => setSelectedStudent(null)}>Cancel</button>
                  <button className="m-btn-primary" onClick={handleLeaveFeedback}
                    disabled={feedbackLoading || !feedbackText.trim()}>
                    {feedbackLoading ? "Sending..." : "Send Feedback"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── STUDENT VIEW ──
  return (
    <div className="mentorship-page">
      <div className="mentorship-header">
        <div>
          <h1>Mentorship</h1>
          <p>Connect with experienced mentors who can guide your startup journey.</p>
        </div>
        <div className="mentorship-stats">
          <div className="m-stat"><strong>{myMentors.length}</strong><span>Mentors</span></div>
          <div className="m-stat"><strong>{allFeedback.length}</strong><span>Feedback</span></div>
        </div>
      </div>

      <div className="m-impact-grid">
        <div className="m-impact-card">
          <strong>{myMentors.length}</strong>
          <span>Mentors connected</span>
        </div>
        <div className="m-impact-card">
          <strong>{allFeedback.length}</strong>
          <span>Feedback received</span>
        </div>
        <div className="m-impact-card">
          <strong>{mentorsWithFeedback}</strong>
          <span>Mentors who reviewed you</span>
        </div>
      </div>
      {latestStudentFeedback && (
        <div className="m-impact-note">
          <strong>Latest mentor insight:</strong>
          <p>“{latestStudentFeedback.feedback.slice(0, 120)}{latestStudentFeedback.feedback.length > 120 ? '...' : ''}”</p>
        </div>
      )}

      <div className="mentorship-tabs">
        {[
          { id: "my-mentors", label: `My Mentors (${myMentors.length})` },
          { id: "find", label: "Find a Mentor" },
          { id: "feedback", label: `Feedback (${allFeedback.length})` }
        ].map(t => (
          <button key={t.id} className={`m-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {loading ? <p className="m-loading">Loading...</p> : (
        <>
          {/* My Mentors */}
          {activeTab === "my-mentors" && (
            <div className="m-section">
              {studentPending.length > 0 && (
                <div className="m-pending-banner">
                  <strong>⏳ {studentPending.length} pending request{studentPending.length > 1 ? "s" : ""}</strong>
                  <p>Waiting for mentor response: {studentPending.map(r => r.mentor_name).join(", ")}</p>
                </div>
              )}
              {myMentors.length === 0 && studentPending.length === 0
                ? <div className="m-empty">
                    <p>You don't have any mentors yet.</p>
                    <button className="m-btn-primary" onClick={() => setActiveTab("find")}>Find a Mentor</button>
                  </div>
                : (
                  <div className="m-students-grid">
                    {myMentors.map(mentor => (
                      <div key={mentor.id} className="m-student-card mentor-card">
                        <div className="m-student-header">
                          <div className="m-avatar mentor-avatar">{mentor.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <strong>{mentor.name}</strong>
                            <span className="m-mentor-badge">Mentor</span>
                            <p>{mentor.bio || "No bio"}</p>
                          </div>
                        </div>
                        {mentor.skills.length > 0 && (
                          <div className="m-tags">
                            {mentor.skills.slice(0, 4).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                          </div>
                        )}
                        {mentor.feedback && mentor.feedback.length > 0 && (
                          <div className="m-feedback-history">
                            <p className="m-section-label">Latest Feedback</p>
                            {mentor.feedback.slice(0, 2).map(f => (
                              <div key={f.id} className="m-feedback-item received">
                                <span className="m-feedback-project">{f.project_title}</span>
                                {f.rating && <span className="m-rating-badge">{'★'.repeat(f.rating)}</span>}
                                <p>{f.feedback}</p>
                                <span className="m-date">{formatDate(f.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Find a Mentor */}
          {activeTab === "find" && (
            <div className="m-section">
              {allMentors.length === 0
                ? <div className="m-empty"><p>{loadError || "No mentors available yet."}</p></div>
                : (
                  <div className="m-mentors-grid">
                    {allMentors.map(mentor => (
                      <div key={mentor.id} className="m-mentor-card">
                        <div className="m-student-header">
                          <div className="m-avatar mentor-avatar">{mentor.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <strong>{mentor.name}</strong>
                            <span className="m-mentor-badge">Mentor</span>
                            <p className="m-mentee-count">{mentor.mentee_count || 0} student{mentor.mentee_count !== 1 ? "s" : ""} mentored</p>
                          </div>
                        </div>
                        {mentor.bio && <p className="m-bio-full">{mentor.bio}</p>}
                        {mentor.skills.length > 0 && (
                          <div className="m-tags">
                            {mentor.skills.slice(0, 5).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                          </div>
                        )}
                        {mentor.interests.length > 0 && (
                          <div className="m-tags">
                            {mentor.interests.slice(0, 3).map(i => <span key={i} className="m-interest-tag">{i}</span>)}
                          </div>
                        )}
                        <button className="m-btn-request" onClick={() => setSelectedMentor(mentor)}>
                          Request Mentorship
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Feedback Received */}
          {activeTab === "feedback" && (
            <div className="m-section">
              {allFeedback.length === 0
                ? <div className="m-empty"><p>No feedback received yet. Your mentor will leave feedback here.</p></div>
                : allFeedback.map(f => (
                  <div key={f.id} className="m-feedback-card">
                    <div className="m-feedback-card-header">
                      <div>
                        <strong>{f.mentor_name}</strong>
                        <span className="m-mentor-badge">Mentor</span>
                      </div>
                      <div className="m-feedback-meta">
                        {f.rating && <span className="m-rating-badge">{'★'.repeat(f.rating)}</span>}
                        <span className="m-date">{formatDate(f.created_at)}</span>
                      </div>
                    </div>
                    {f.project_title && f.project_title !== "General" && (
                      <span className="m-feedback-project">📁 {f.project_title}</span>
                    )}
                    <p className="m-feedback-text">{f.feedback}</p>
                  </div>
                ))
              }
            </div>
          )}
        </>
      )}

      {/* Request Mentorship Modal */}
      {selectedMentor && (
        <div className="m-modal-overlay" onClick={() => setSelectedMentor(null)}>
          <div className="m-modal" onClick={e => e.stopPropagation()}>
            <div className="m-modal-header">
              <div>
                <h3>Request Mentorship</h3>
                <p>From {selectedMentor.name}</p>
              </div>
              <button className="m-close" onClick={() => setSelectedMentor(null)}>×</button>
            </div>
            <div className="m-modal-body">
              <div className="m-mentor-preview">
                <div className="m-avatar mentor-avatar">{selectedMentor.name.charAt(0).toUpperCase()}</div>
                <div>
                  <strong>{selectedMentor.name}</strong>
                  <p>{selectedMentor.bio || "Experienced mentor"}</p>
                  <div className="m-tags">
                    {selectedMentor.skills.slice(0, 4).map(s => <span key={s} className="m-skill-tag">{s}</span>)}
                  </div>
                </div>
              </div>

              <div className="m-field">
                <label>Message to mentor *</label>
                <textarea value={requestMessage} onChange={e => setRequestMessage(e.target.value)}
                  placeholder="Tell the mentor about yourself, your startup idea, and what kind of guidance you're looking for..."
                  rows={5} />
              </div>

              {requestSuccess && (
                <p className={`${requestSuccess.includes("success") ? "m-success" : "m-error"}`}>
                  {requestSuccess}
                </p>
              )}

              <div className="m-modal-actions">
                <button className="m-btn-secondary" onClick={() => setSelectedMentor(null)}>Cancel</button>
                <button className="m-btn-primary" onClick={handleSendRequest}
                  disabled={requestLoading || !requestMessage.trim()}>
                  {requestLoading ? "Sending..." : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}