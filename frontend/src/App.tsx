import React, { useState } from 'react'
import axios from 'axios'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

import Navbar from './components/Navbar'
import Home from './components/Home'
import SignIn from './components/SignIn'
import Register from './components/Register'
const App: React.FC = () => {
  // simple auth state (frontend-only). Real auth uses backend tokens.
  const [user, setUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('csh_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const isLoggedIn = !!localStorage.getItem("csh_token");

  const handleLogin = (userObj: any) => {
    setUser(userObj)
    localStorage.setItem('csh_user', JSON.stringify(userObj))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('csh_user')
    localStorage.removeItem('csh_token')
  }

  // Navbar handlers (simple navigation)
  const onFeaturesClick = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const onStatsClick = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const onGetStartedClick = () => window.location.assign('/register')
  const onLoginClick = () => window.location.assign('/signin')
  const onRegisterClick = () => window.location.assign('/register')

 

  // Register handler (calls backend)
  const handleRegister = async (userData: any) => {
    try {
      const payload = {
  name: userData.name,
  email: userData.email,
  password: userData.password,
  role: userData.role,
  skills: userData.skills,
  interests: userData.interests,
  lookingFor: userData.lookingFor,
  bio: userData.bio
}
      const resp = await axios.post('http://127.0.0.1:5000/api/auth/register', payload)
      const { access_token, user_id } = resp.data || {}
      const userObj = { id: user_id || Math.random().toString(36).slice(2, 9), name: userData.name || (userData.email || '').split('@')[0], email: userData.email, role: userData.role || 'student' }
      if (access_token) localStorage.setItem('csh_token', access_token)
      handleLogin(userObj)
      window.location.assign('/')
    } catch (err: any) {
      console.error('Registration failed', err?.response?.data || err)
      alert(err?.response?.data?.error || 'Registration failed')
    }
  }
 // SignIn handler (calls backend)
  const handleSignIn = async (email: string, password: string) => {
    try {
      const resp = await axios.post('http://127.0.0.1:5000/api/auth/login', { email, password })
      const { access_token, user_id } = resp.data || {}
      // Build a minimal frontend user object from email; backend currently returns id + token
      const userObj = { id: user_id || Math.random().toString(36).slice(2, 9), name: email.split('@')[0], email, role: 'student' }
      // persist  + user
      if (access_token) localStorage.setItem('csh_token', access_token)
      handleLogin(userObj)
      window.location.assign('/')
    } catch (err: any) {
      console.error('Sign-in failed', err?.response?.data || err)
      alert(err?.response?.data?.error || 'Sign-in failed')
    }
  }
  return (
    <HashRouter>
      <Navbar
        onFeaturesClick={onFeaturesClick}
        onStatsClick={onStatsClick}
        onGetStartedClick={onGetStartedClick}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />
      <Routes>
        <Route path="/signin" element={<SignIn onSignIn={handleSignIn} onSwitchToRegister={() => window.location.assign('/register')} />} />
        <Route path="/register" element={<Register onRegister={handleRegister} onSwitchToLogin={() => window.location.assign('/signin')} />} />
        <Route path="/" element={user ? <Home user={user} onLogout={handleLogout} /> : <Navigate to="/signin" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
