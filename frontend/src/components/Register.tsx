// src/components/Register.tsx
import { useState } from 'react';
import type { User, UserRole } from '../types/index.ts';
import './Register.css';

interface RegisterProps {
  onRegister: (user: Omit<User, 'id'>) => void;
  onSwitchToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student' as UserRole,
    skills: [] as string[],
    interests: [] as string[],
    lookingFor: [] as string[],
    bio: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [newSkill, setNewSkill] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [formError, setFormError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const addInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handleLookingForChange = (value: string) => {
    setFormData(prev => {
      const current = prev.lookingFor;
      if (current.includes(value as any)) {
        return { ...prev, lookingFor: current.filter(item => item !== value) };
      } else {
        return { ...prev, lookingFor: [...current, value as any] };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.lookingFor.length === 0) {
      setFormError("Select at least one role you're looking for to continue.");
      return;
    }

    setFormError('');
    onRegister({ ...formData, createdAt: new Date() });
  };

  const nextStep = () => {
    setFormError('');
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // Handle Enter key for adding skills and interests
  const handleKeyPress = (e: React.KeyboardEvent, type: 'skill' | 'interest') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'skill') {
        addSkill();
      } else {
        addInterest();
      }
    }
  };

  return (
    <div className="auth-page register-page">
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-brand">
            <span className="auth-brand-icon">🎓</span>
            <span className="auth-brand-name">projectHub</span>
          </div>

          <h1>
            Build. <span>Connect.</span> Grow.
          </h1>

          <p>
            Join student founders and mentors building ideas, teams, and impact.
          </p>

          <div className="auth-left-features">
            <div className="auth-feature">🚀 Validate ideas</div>
            <div className="auth-feature">🤝 Find your team</div>
            <div className="auth-feature">🎓 Get mentorship</div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="register-card">
          <div className="register-header">
            <h2>Join projectHub</h2>
            <p>Start your entrepreneurial journey today</p>
          </div>

          <form onSubmit={handleSubmit} className="register-form" autoComplete="off">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="form-step active">
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="input-group">
                <label>I am a</label>
                <div className="role-selection">
                  <button
                    type="button"
                    className={`role-btn ${formData.role === 'student' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))}
                  >
                    🎓 Student
                  </button>
                  <button
                    type="button"
                    className={`role-btn ${formData.role === 'mentor' ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, role: 'mentor' }))}
                  >
                    👨‍💼 Mentor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Skills & Interests */}
          {currentStep === 2 && (
            <div className="form-step active">
              <h3 style={{color:"#8597b2"}}>Skills & Interests</h3>
              
              <div className="input-group">
                <label>Your Skills</label>
                <div className="tag-input-container">
                  <div className="tag-input">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add a skill (e.g., React, Marketing)"
                      onKeyPress={(e) => handleKeyPress(e, 'skill')}
                    />
                    <button type="button" onClick={addSkill} className="add-btn" disabled={!newSkill.trim()}>
                      <span className="add-icon">+</span>
                    </button>
                  </div>
                  <div className="tags">
                    {formData.skills.map(skill => (
                      <span key={skill} className="tag">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="remove-tag">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Your Interests</label>
                <div className="tag-input-container">
                  <div className="tag-input">
                    <input
                      type="text"
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      placeholder="Add interests (e.g., AI, Sustainability)"
                      onKeyPress={(e) => handleKeyPress(e, 'interest')}
                    />
                    <button type="button" onClick={addInterest} className="add-btn" disabled={!newInterest.trim()}>
                      <span className="add-icon">+</span>
                    </button>
                  </div>
                  <div className="tags">
                    {formData.interests.map(interest => (
                      <span key={interest} className="tag">
                        {interest}
                        <button type="button" onClick={() => removeInterest(interest)} className="remove-tag">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Goals & Bio */}
          {currentStep === 3 && (
            <div className="form-step active">
              <h3 style={{color:"#8597b2"}}>Goals & Bio</h3>
              
              <div className="input-group">
                <label>I'm looking for</label>
                <p className="subtext">Choose at least one option to help us match you better.</p>
                <div className="checkbox-group">
                  {['co-founder', 'developer', 'designer', 'mentor', 'investor'].map(option => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.lookingFor.includes(option as any)}
                        onChange={() => {
                          handleLookingForChange(option);
                          if (formError) setFormError('');
                        }}
                      />
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  placeholder="Tell us about yourself, your experience, and what you're passionate about..."
                  rows={4}
                />
              </div>

              {formError && <div className="form-error">{formError}</div>}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="form-navigation">
            {currentStep > 1 && (
              <button type="button" onClick={prevStep} className="nav-btn secondary">
                ← Previous
              </button>
            )}
            
            {currentStep < 3 ? (
              <button type="button" onClick={nextStep} className="nav-btn primary">
                Next →
              </button>
            ) : (
              <button type="submit" className="nav-btn primary submit-btn">
                🚀 Create Account
              </button>
            )}
          </div>
        </form>

        <div className="switch-auth">
          <p>Already have an account? <button onClick={onSwitchToLogin} className="link-btn">Sign In</button></p>
        </div>
      </div>
    </div>
  </div>
  );
};

export default Register;