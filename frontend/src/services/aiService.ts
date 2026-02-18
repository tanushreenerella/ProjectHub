// src/services/aiService.ts
const API_BASE = 'http://localhost:5000/api';

export class AIService {
  private static async callBackendAI(prompt: string): Promise<any> {
    const response = await fetch(`${API_BASE}/ai/improve-proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: prompt })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    // Ensure response structure is valid
    return {
      feedback: data.feedback || '',
      score: data.score || 6,
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      improvements: Array.isArray(data.improvements) ? data.improvements : [],
      businessNames: Array.isArray(data.businessNames) ? data.businessNames : []
    };
  }

  private static generateIntelligentFallback(idea: string): any {
    const ideaLower = idea.toLowerCase();
    
    // Detect idea features
    const isMarketplace = /marketplace|buy|sell|trade|exchange|market/.test(ideaLower);
    const isEducation = /study|learn|teach|tutor|course|education|school/.test(ideaLower);
    const isFood = /food|delivery|eat|restaurant|dining/.test(ideaLower);
    const isSocial = /connect|network|friend|community|social|team|match/.test(ideaLower);
    const isService = /service|help|support|clean|repair|task/.test(ideaLower);
    
    let category = 'General Student Startup';
    if (isMarketplace) category = 'Peer-to-Peer Marketplace';
    else if (isEducation) category = 'EdTech Platform';
    else if (isFood) category = 'Food & Campus Service';
    else if (isSocial) category = 'Social/Networking Platform';
    else if (isService) category = 'Campus Service';
    
    // Generate contextual analysis
    const strengthsMap: { [key: string]: string[] } = {
      'Peer-to-Peer Marketplace': [
        'Network effects can drive exponential growth',
        'Monetization through commissions or premium is straightforward',
        'Addresses real inefficiencies in current offerings'
      ],
      'EdTech Platform': [
        'Massive addressable market of engaged students',
        'High user retention due to academic incentives',
        'Opportunity to improve learning outcomes'
      ],
      'Food & Campus Service': [
        'Recurring revenue and daily user engagement',
        'Low customer acquisition cost through campus word-of-mouth',
        'Strong unit economics with direct to consumer'
      ],
      'Social/Networking Platform': [
        'Viral growth potential through social features',
        'Strong switching costs once community forms',
        'Multiple monetization pathways'
      ],
      'Campus Service': [
        'Solves real pain points students face',
        'Potential for operational efficiency and scaling',
        'Direct market validation through campus presence'
      ]
    };
    
    const improvementsMap: { [key: string]: string[] } = {
      'Peer-to-Peer Marketplace': [
        'Develop trust & safety features (verification, ratings, disputes)',
        'Plan unit economics carefully - how do you cover transaction costs?',
        'Consider supply-side vs demand-side growth strategy'
      ],
      'EdTech Platform': [
        'Validate with actual students - does it solve their top pain point?',
        'Define sustainable business model (B2B2C, B2B, or consumer subscription)',
        'Build accessibility and compliance into core product'
      ],
      'Food & Campus Service': [
        'Confirm food safety/compliance requirements for your jurisdiction',
        'Secure partnerships with campus dining or local suppliers first',
        'Plan delivery logistics and worker economics carefully'
      ],
      'Social/Networking Platform': [
        'Differentiate clearly from existing platforms (niche, features, values)',
        'Plan aggressive user retention - networks are all-or-nothing',
        'Establish moderation policies before launch'
      ],
      'Campus Service': [
        'Research campus policies and permissions needed',
        'Develop go-to-market through student organizations',
        'Validate demand with target user interviews first'
      ]
    };
    
    const strengthsList = strengthsMap[category] || strengthsMap['General Student Startup'];
    const improvementsList = improvementsMap[category] || [
      'Validate core assumptions with 10+ target customers',
      'Create detailed MVP roadmap with must-have features',
      'Develop 6-month financial projections and unit economics'
    ];
    
    // Generate business names based on idea
    let businessNames: string[] = [];
    if (isMarketplace) {
      businessNames = ['SwapHub', 'PeerMart', 'CampusExchange', 'QuickTrade', 'LocalHub'];
    } else if (isEducation) {
      businessNames = ['StudyMate', 'LearnHub', 'AcademySync', 'EduConnect', 'ClassFlow'];
    } else if (isFood) {
      businessNames = ['CampusEats', 'DormFresh', 'QuickBite', 'NightMunch', 'LocalFeast'];
    } else if (isSocial) {
      businessNames = ['CampusConnect', 'PeerLink', 'UniMate', 'TeamUp', 'SyncHub'];
    } else {
      businessNames = ['QuickService', 'CampusHelper', 'TaskFlow', 'HelpHub', 'ProService'];
    }
    
    const score = 6 + Math.floor((idea.length - 50) / 100);
    
    return {
      feedback: `🚀 **Idea**: Your proposal for a ${category} shows solid understanding of student pain points.\n\n🎯 **Opportunity**: There's real demand here. Students are actively seeking solutions to this problem.\n\n💡 **Next Steps**: Validate with 5-10 target users. What's their #1 problem you'd solve? Build MVP with only core features. Growth comes after proving product-market fit, not before.`,
      score: Math.min(10, Math.max(5, score)),
      strengths: strengthsList,
      improvements: improvementsList,
      businessNames: businessNames
    };
  }

  static async generateBusinessName(idea: string): Promise<string[]> {
    const data = await this.callBackendAI(idea);
    return data.businessNames || [];
  }

  static async improveProposal(idea: string) {
    try {
      if (!idea || idea.trim().length < 15) {
        return {
          feedback: 'Please provide a more detailed description of your idea (at least 15 characters).',
          score: 0,
          strengths: [],
          improvements: ['Describe the problem', 'Explain your solution', 'Who is your target user?'],
          businessNames: []
        };
      }
      
      const result = await this.callBackendAI(idea);
      return result;
    } catch (error) {
      console.error('AI Service error, using intelligent fallback:', error);
      return this.generateIntelligentFallback(idea);
    }
  }

  static async analyzeIdea(idea: string) {
    return await this.improveProposal(idea);
  }
}
