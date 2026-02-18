// src/components/FundingPortal.tsx
import { useState, useEffect } from 'react';
import type { FundingOpportunity, FundingApplication, Investor, Project } from '../types/index.ts';
import { FundingService } from '../services/fundingService';
import './FundingPortal.css';

interface FundingPortalProps {
  user: { id: string };
  onApplicationSubmit: (application: FundingApplication) => void;
}

const FundingPortal: React.FC<FundingPortalProps> = ({ user, onApplicationSubmit }) => {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'applications' | 'investors'>('opportunities');
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [applications, setApplications] = useState<FundingApplication[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<FundingOpportunity | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    stage: '',
    search: ''
  });

  const [applicationForm, setApplicationForm] = useState({
    projectId: '',
    requestedAmount: 0,
    proposal: ''
  });
  const [projects, setProjects] = useState<Project[]>([]);
const token = localStorage.getItem("csh_token");

useEffect(() => {
  fetch("http://127.0.0.1:5000/api/projects/my", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
  const formatted = (data.projects || []).map((p: any) => ({
    id: p._id,
    title: p.title,
    description: p.description,
    category: p.category,
    stage: p.stage,
    skillsNeeded: p.skills_required,
    createdAt: p.created_at
  }));
  setProjects(formatted);
});

}, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [opps, apps, invs] = await Promise.all([
        FundingService.getFundingOpportunities(filters),
        FundingService.getMyApplications(user.id),
        FundingService.getInvestors()
      ]);
      setOpportunities(opps);
      setApplications(apps);
      setInvestors(invs);
    } catch (error) {
      console.error('Error loading funding data:', error);
    }
    setLoading(false);
  };

  const handleApply = (opportunity: FundingOpportunity) => {
    setSelectedOpportunity(opportunity);
    setApplicationForm({
      projectId: projects[0]?.id || '',
      requestedAmount: 10000,
      proposal: `I am applying for ${opportunity.title} to support my project.`
    });
    setShowApplicationModal(true);
  };

  const handleSeed = async () => {
    setLoading(true);
    try {
      await FundingService.seedData();
      // reload
      await loadData();
      alert('Seeded funding data successfully');
    } catch (err) {
      console.error('Seed failed', err);
      alert('Seed failed. Check backend logs and ensure you are authenticated.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewApplication = () => {
    // Open modal without a preselected opportunity
    setSelectedOpportunity(null);
    setApplicationForm({
      projectId: projects[0]?.id || '',
      requestedAmount: 5000,
      proposal: ''
    });
    setShowApplicationModal(true);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity) return;

    try {
      const application = await FundingService.submitApplication({
        opportunityId: selectedOpportunity.id,
        applicantId: user.id,
        projectId: applicationForm.projectId,
        status: 'submitted',
        proposal: applicationForm.proposal,
        requestedAmount: applicationForm.requestedAmount
      });

      setApplications(prev => [...prev, application]);
      onApplicationSubmit(application);
      setShowApplicationModal(false);
      setSelectedOpportunity(null);
    } catch (error) {
      console.error('Error submitting application:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: '#6b7280', label: 'Draft' },
      submitted: { color: '#3b82f6', label: 'Submitted' },
      under_review: { color: '#f59e0b', label: 'Under Review' },
      approved: { color: '#10b981', label: 'Approved' },
      rejected: { color: '#ef4444', label: 'Rejected' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <span className="status-badge" style={{ backgroundColor: config.color }}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="funding-portal">
      <div className="funding-header">
        <h1>💰 Funding Portal</h1>
        <p>Discover funding opportunities and connect with investors</p>
      </div>

      {/* Stats */}
      <div className="funding-stats">
        <div className="stat-card">
          <h4>Total Opportunities</h4>
          <p>{loading ? '—' : opportunities.length}</p>
        </div>

        <div className="stat-card">
          <h4>Total Investors</h4>
          <p>{loading ? '—' : investors.length}</p>
        </div>

        <div className="stat-card">
          <h4>My Applications</h4>
          <p>{loading ? '—' : applications.length}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="funding-tabs">
        <button 
          className={`tab ${activeTab === 'opportunities' ? 'active' : ''}`}
          onClick={() => setActiveTab('opportunities')}
        >
          🎯 Opportunities
        </button>
        <button 
          className={`tab ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
           📋 My Applications
        </button>
        <button className="seed-btn" onClick={handleSeed} title="Seed sample funding data (dev)">
          ⚙️ Seed Data
        </button>
        <button 
          className={`tab ${activeTab === 'investors' ? 'active' : ''}`}
          onClick={() => setActiveTab('investors')}
        >
          👥 Investors
        </button>
      </div>

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="opportunities-tab">
          <div className="filters-bar">
            <input
              type="text"
              placeholder="Search opportunities..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="search-input"
            />
            <select 
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="grant">Grants</option>
              <option value="competition">Competitions</option>
              <option value="investor">Investors</option>
              <option value="crowdfunding">Crowdfunding</option>
            </select>
            <select 
              value={filters.stage}
              onChange={(e) => setFilters(prev => ({ ...prev, stage: e.target.value }))}
              className="filter-select"
            >
              <option value="">All Stages</option>
              <option value="ideation">Ideation</option>
              <option value="prototype">Prototype</option>
              <option value="launched">Launched</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Loading opportunities...</div>
          ) : (
            <div className="opportunities-grid">
              {opportunities.map(opportunity => (
                <div key={opportunity.id} className="opportunity-card">
                  <div className="card-header">
                    <h3>{opportunity.title}</h3>
                    <span className={`category-badge ${opportunity.category}`}>
                      {opportunity.category}
                    </span>
                  </div>
                  
                  <div className="card-body">
                    <div className="opportunity-meta">
                      <div className="meta-item">
                        <strong>Provider:</strong>
                        <span>{opportunity.provider}</span>
                      </div>
                      <div className="meta-item">
                        <strong>Amount:</strong>
                        <span className="amount">{opportunity.amount}</span>
                      </div>
                      <div className="meta-item">
                        <strong>Deadline:</strong>
                        <span>{opportunity.deadline.toLocaleDateString()}</span>
                      </div>
                      <div className="meta-item">
                        <strong>Stage:</strong>
                        <span className={`stage ${opportunity.stage}`}>
                          {opportunity.stage}
                        </span>
                      </div>
                    </div>

                    <p className="description">{opportunity.description}</p>

                    <div className="eligibility">
                      <strong>Eligibility:</strong>
                      <ul>
                        {opportunity.eligibility.map(item => (
                          <li key={item}>✓ {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="tags">
                      {opportunity.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="card-actions">
                    <button 
                      className="btn-primary"
                      onClick={() => handleApply(opportunity)}
                    >
                      Apply Now
                    </button>
                    {opportunity.website && (
                      <a 
                        href={opportunity.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-secondary"
                      >
                        Learn More
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="applications-tab">
          <div className="applications-header">
            <h2>My Funding Applications</h2>
            <p>Track your funding requests and their status</p>
          </div>

          <div className="applications-actions">
            <button className="btn-primary" onClick={handleNewApplication}>+ New Application</button>
          </div>

          <div className="applications-list">
            {applications.map(application => {
              const opportunity = opportunities.find(o => o.id === application.opportunityId);
              const project = projects.find(p => p.id === application.projectId);
              
              return (
                <div key={application.id} className="application-card">
                  <div className="app-header">
                    <div>
                      <h4>{opportunity?.title || 'Unknown Opportunity'}</h4>
                      <p>Project: {project?.title || 'Unknown Project'}</p>
                    </div>
                    {getStatusBadge(application.status)}
                  </div>
                  
                  <div className="app-details">
                    <div className="detail">
                      <strong>Requested Amount:</strong>
                      <span>${(application.requestedAmount ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="detail">
                      <strong>Submitted:</strong>
                      <span>
                        {application.submittedAt 
                          ? application.submittedAt.toLocaleDateString()
                          : 'Draft'
                        }
                      </span>
                    </div>
                    {application.notes && (
                      <div className="detail">
                        <strong>Notes:</strong>
                        <span>{application.notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="app-actions">
                    {application.status === 'draft' && (
                      <button className="btn-primary">
                        Continue Application
                      </button>
                    )}
                    <button className="btn-outline">
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}

            {applications.length === 0 && (
              <div className="no-applications">
                <h3>No applications yet</h3>
                <p>Start by applying to funding opportunities!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Investors Tab */}
      {activeTab === 'investors' && (
        <div className="investors-tab">
          <div className="investors-header">
            <h2>👥 Investor Network</h2>
            <p>Connect with investors interested in student startups</p>
          </div>

          <div className="investors-grid">
            {investors.map(investor => (
              <div key={investor.id} className="investor-card">
                <div className="investor-header">
                  <div className="investor-avatar">
                    {investor.name.charAt(0)}
                  </div>
                  <div className="investor-info">
                    <h3>{investor.name}</h3>
                    <p className="company">{investor.company}</p>
                    <p className="investment-range">{investor.investmentRange}</p>
                  </div>
                </div>

                <div className="investor-bio">
                  <p>{investor.bio}</p>
                </div>

                <div className="focus-areas">
                  <strong>Focus Areas:</strong>
                    <div className="focus-tags">
                    {(investor.focusAreas || []).map(area => (
                      <span key={area} className="focus-tag">{area}</span>
                    ))}
                    </div>
                </div>

                <div className="previous-investments">
                  <strong>Previous Investments:</strong>
                  <ul>
                    {(investor.previousInvestments || []).map(investment => (
                      <li key={investment}>✓ {investment}</li>
                    ))}
                  </ul>
                </div>

                <div className="investor-actions">
                  <a 
                    href={`mailto:${investor.contactEmail}`}
                    className="btn-primary"
                  >
                    📧 Contact
                  </a>
                  <a 
                    href={investor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    🌐 Website
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Application Modal */}
      {showApplicationModal && (
        <div className="modal-overlay">
          <div className="application-modal">
            <div className="modal-header">
              <h2>Apply for {selectedOpportunity ? selectedOpportunity.title : 'New Application'}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowApplicationModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitApplication} className="modal-form">
              {!selectedOpportunity && (
                <div className="form-group">
                  <label>Select Opportunity</label>
                  <select
                    value={applicationForm.projectId}
                    onChange={(e) => {
                      // set a temporary field to hold chosen opportunity id
                      setSelectedOpportunity(opportunities.find(o => o.id === e.target.value) || null);
                    }}
                    required
                  >
                    <option value="">Choose an opportunity...</option>
                    {opportunities.map(op => (
                      <option key={op.id} value={op.id}>{op.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Select Project</label>
                <select
                  value={applicationForm.projectId}
                  onChange={(e) => setApplicationForm(prev => ({ ...prev, projectId: e.target.value }))}
                  required
                >
                  <option value="">Choose a project...</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Requested Amount ($)</label>
                <input
                  type="number"
                  value={applicationForm.requestedAmount}
                  onChange={(e) => setApplicationForm(prev => ({ ...prev, requestedAmount: Number(e.target.value) }))}
                  min="1000"
                  max="100000"
                  required
                />
              </div>

              <div className="form-group">
                <label>Proposal</label>
                <textarea
                  value={applicationForm.proposal}
                  onChange={(e) => setApplicationForm(prev => ({ ...prev, proposal: e.target.value }))}
                  placeholder="Describe your project, team, and how you'll use the funding..."
                  rows={6}
                  required
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowApplicationModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundingPortal;