// src/services/fundingService.ts
import type { FundingOpportunity, FundingApplication, Investor } from '../types/index.ts';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api/funding' : '/api/funding';

function authHeader() {
  const token = localStorage.getItem('csh_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class FundingService {
  static async getFundingOpportunities(filters?: { category?: string; stage?: string; search?: string; }): Promise<FundingOpportunity[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.stage) params.append('stage', filters.stage);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/opportunities?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load opportunities');
    const data = await res.json();
    // convert date strings to Date objects for compatibility with UI
    return data.map((d: any) => ({ ...d, deadline: d.deadline ? new Date(d.deadline) : null }));
  }

  static async getInvestors(): Promise<Investor[]> {
    const res = await fetch(`${API_BASE}/investors`);
    if (!res.ok) throw new Error('Failed to load investors');
    const data = await res.json();
    // normalize snake_case -> camelCase and provide defaults
    return (data || []).map((d: any) => ({
      id: d.id || d._id,
      name: d.name,
      company: d.company,
      investmentRange: d.investment_range || d.investmentRange || '',
      bio: d.bio || '',
      focusAreas: d.focus_areas || d.focusAreas || [],
      previousInvestments: d.previous_investments || d.previousInvestments || [],
      contactEmail: d.contact_email || d.contactEmail || '',
      website: d.website || ''
    }));
  }

  static async submitApplication(application: {
    opportunityId: string;
    applicantId?: string;
    projectId: string;
    requestedAmount: number;
    proposal: string;
    status?: string;
  }): Promise<FundingApplication> {
    const res = await fetch(`${API_BASE}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader()
      },
      body: JSON.stringify(application)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to submit application');
    }

    const data = await res.json();
    // normalize backend snake_case to camelCase and parse dates
    const normalized: any = {
      id: data.id || data._id,
      opportunityId: data.opportunity_id || data.opportunityId,
      applicantId: data.applicant_id || data.applicantId,
      projectId: data.project_id || data.projectId,
      requestedAmount: data.requested_amount ?? data.requestedAmount ?? 0,
      proposal: data.proposal,
      status: data.status,
      submittedAt: data.submitted_at ? new Date(data.submitted_at) : (data.submittedAt ? new Date(data.submittedAt) : null),
      createdAt: data.created_at ? new Date(data.created_at) : (data.createdAt ? new Date(data.createdAt) : null)
    };

    return normalized as FundingApplication;
  }

  static async getMyApplications(userId: string): Promise<FundingApplication[]> {
    const res = await fetch(`${API_BASE}/applications/${userId}`, {
      headers: {
        ...authHeader()
      }
    });
    if (!res.ok) throw new Error('Failed to load applications');
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id || d._id,
      opportunityId: d.opportunity_id || d.opportunityId,
      applicantId: d.applicant_id || d.applicantId,
      projectId: d.project_id || d.projectId,
      requestedAmount: d.requested_amount ?? d.requestedAmount ?? 0,
      proposal: d.proposal,
      status: d.status,
      submittedAt: d.submitted_at ? new Date(d.submitted_at) : (d.submittedAt ? new Date(d.submittedAt) : null),
      createdAt: d.created_at ? new Date(d.created_at) : (d.createdAt ? new Date(d.createdAt) : null)
    }));
  }

  static async seedData(): Promise<{status: string}> {
    const token = localStorage.getItem('csh_token');
    const res = await fetch(`${API_BASE}/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
      const err = await res.text().catch(() => 'seed failed');
      throw new Error(err || 'Failed to seed data');
    }
    return res.json();
  }
}