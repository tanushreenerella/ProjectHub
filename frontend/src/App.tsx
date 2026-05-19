import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

import Landing from './components/Landing'
import Home from './components/Home'
import SignIn from './components/SignIn'
import Register from './components/Register'

const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    try {
      const token = localStorage.getItem('csh_token')
      if (!token) {
        localStorage.removeItem('csh_user')
        return null
      }
      const raw = localStorage.getItem('csh_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const handleLogin = (userObj: any) => {
    setUser(userObj)
    localStorage.setItem('csh_user', JSON.stringify(userObj))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('csh_user')
    localStorage.removeItem('csh_token')
  }

  useEffect(() => {
    const token = localStorage.getItem('csh_token')
    if (!token) return
    const refreshUser = async () => {
      try {
        const resp = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const profile = resp.data || {}
        handleLogin({
          id: profile.id || user?.id || Math.random().toString(36).slice(2, 9),
          name: profile.name || user?.name || '',
          email: profile.email || user?.email || '',
          role: String(profile.role || user?.role || 'student').trim().toLowerCase(),
          skills: profile.skills || user?.skills || [],
          interests: profile.interests || user?.interests || [],
          bio: profile.bio || user?.bio || ''
        })
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 401 || status === 404 || status === 422) {
          handleLogout()
        } else {
          console.warn('Could not refresh user profile', err)
        }
      }
    }
    refreshUser()
  }, [])

  const handleRegister = async (userData: any) => {
    try {
      const resp = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        skills: userData.skills,
        interests: userData.interests,
        lookingFor: userData.lookingFor,
        bio: userData.bio
      })
      const { access_token, user_id } = resp.data || {}
      if (access_token) localStorage.setItem('csh_token', access_token)
      handleLogin({
        id: user_id || Math.random().toString(36).slice(2, 9),
        name: userData.name || userData.email.split('@')[0],
        email: userData.email,
        role: String(userData.role || 'student').trim().toLowerCase(),
        skills: userData.skills || [],
        interests: userData.interests || [],
        bio: userData.bio || ''
      })
      window.location.assign('#/')
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Registration failed')
    }
  }

  const handleSignIn = async (email: string, password: string) => {
    try {
      const resp = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login`, { email, password })
      const { access_token, user_id, role, name, email: returnedEmail } = resp.data || {}
      if (access_token) localStorage.setItem('csh_token', access_token)

      let profile = { role, name, email: returnedEmail, skills: [], interests: [], bio: '' } as any
      if (access_token) {
        try {
          const profileResp = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${access_token}` }
          })
          profile = { ...profile, ...profileResp.data }
        } catch { /* use login response data */ }
      }

      handleLogin({
        id: user_id || Math.random().toString(36).slice(2, 9),
        name: profile.name || email.split('@')[0],
        email: profile.email || email,
        role: String(profile.role || 'student').trim().toLowerCase(),
        skills: profile.skills || [],
        interests: profile.interests || [],
        bio: profile.bio || ''
      })
      window.location.assign('#/')
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Sign-in failed')
    }
  }

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      const resp = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/google-login`, { id_token: idToken })
      const { access_token, user_id, role, name, email: returnedEmail } = resp.data || {}
      if (access_token) localStorage.setItem('csh_token', access_token)

      handleLogin({
        id: user_id || Math.random().toString(36).slice(2, 9),
        name: name || returnedEmail?.split('@')[0] || '',
        email: returnedEmail || '',
        role: String(role || 'student').trim().toLowerCase()
      })
      window.location.assign('#/')
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Google sign-in failed')
    }
  }

  return (
    <HashRouter>
      <Routes>
        {/* Landing page — shown to unauthenticated visitors */}
        <Route path="/landing" element={
          <Landing
            onGetStarted={() => window.location.assign('#/register')}
            onLogin={() => window.location.assign('#/signin')}
          />
        } />

        <Route path="/signin" element={
          user ? <Navigate to="/" replace /> :
          <SignIn
            onSignIn={handleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            onSwitchToRegister={() => window.location.assign('#/register')}
          />
        } />

        <Route path="/register" element={
          user ? <Navigate to="/" replace /> :
          <Register
            onRegister={handleRegister}
            onSwitchToLogin={() => window.location.assign('#/signin')}
          />
        } />

        {/* Main app */}
        <Route path="/" element={
          user
            ? <Home user={user} onLogout={handleLogout} />
            : <Navigate to="/landing" replace />
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
