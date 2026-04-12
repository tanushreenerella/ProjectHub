// src/types/index.ts
export type UserRole = 'student' | 'mentor';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  skills: string[];
  interests: string[];
  lookingFor: string[];
  bio: string;
  createdAt: Date;
}

// Add UserProfile interface
export interface UserProfile extends User {
  projects: string[];
  connections: string[];
  pendingRequests: string[];
  score?: number;   // ⭐ ADD THIS
}


export interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  stage?: string;
  skillsNeeded: string[];
  creatorId: string;
  createdAt: Date;
  team_members?: string[];
  owner_id?: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  created_by: string;
  created_at: Date;
}

export interface TeamMember {
  id: string;
  name: string;
  skills: string[];
  bio: string;
}

export interface Mentor {
  id: string;
  name: string;
  expertise: string[];
  availability: 'available' | 'limited' | 'unavailable';
  bio: string;
}

// Add these new interfaces for Team Finder
export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface TeamSearchFilters {
  skills: string[];
  interests: string[];
  role: string;
  availability: 'full-time' | 'part-time' | 'flexible';
}
// Add to your existing types in src/types/index.ts
export interface FundingOpportunity {
  id: string;
  title: string;
  provider: string;
  amount: string;
  deadline: Date;
  eligibility: string[];
  description: string;
  category: 'grant' | 'competition' | 'investor' | 'crowdfunding';
  stage: 'ideation' | 'prototype' | 'launched';
  tags: string[];
  website?: string;
  contactEmail?: string;
}

export interface FundingApplication {
  id: string;
  opportunityId: string;
  applicantId: string;
  projectId: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  proposal: string;
  requestedAmount: number;
  submittedAt?: Date;
  createdAt: Date;
  notes?: string;
}

export interface Investor {
  id: string;
  name: string;
  company: string;
  focusAreas: string[];
  investmentRange: string;
  website: string;
  contactEmail: string;
  bio: string;
  previousInvestments: string[];
}
// Add to types/index.ts

export interface Conversation {
  id: string;
  participants: string[]; // array of user ids
  lastMessage: string;
  lastUpdated: Date;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Date;
}
