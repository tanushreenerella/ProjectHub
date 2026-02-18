import React, { useState} from 'react'
import axios from 'axios'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './App.css'

import Home from './components/Home'
import SignIn from './components/SignIn'
import Register from './components/Register'
import Navbar from './components/Navbar'
const AppContent: React.FC = () => {
  const navigate = useNavigate()

  const [user, setUser] = useState<any>(() => {
    try {
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

  // ✅ FIXED NAVIGATION
  const onFeaturesClick = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const onStatsClick = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const onGetStartedClick = () => navigate('/register')
  const onLoginClick = () => navigate('/signin')
  const onRegisterClick = () => navigate('/register')

  const handleRegister = async (userData: any) => {
    try {
      const resp = await axios.post('http://127.0.0.1:5000/api/auth/register', userData)
      const { access_token, user_id } = resp.data || {}

      const userObj = {
        id: user_id || Math.random().toString(36).slice(2, 9),
        name: userData.name || userData.email.split('@')[0],
        email: userData.email,
        role: userData.role || 'student'
      }

      if (access_token) localStorage.setItem('csh_token', access_token)
      handleLogin(userObj)

      navigate('/')   // ✅ FIXED
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Registration failed')
    }
  }

  const handleSignIn = async (email: string, password: string) => {
    try {
      const resp = await axios.post('http://127.0.0.1:5000/api/auth/login', { email, password })
      const { access_token, user_id } = resp.data || {}

      const userObj = {
        id: user_id || Math.random().toString(36).slice(2, 9),
        name: email.split('@')[0],
        email,
        role: 'student'
      }

      if (access_token) localStorage.setItem('csh_token', access_token)
      handleLogin(userObj)

      navigate('/')   // ✅ FIXED
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Sign-in failed')
    }
  }

  return (
    <>
      <Navbar
        onFeaturesClick={onFeaturesClick}
        onStatsClick={onStatsClick}
        onGetStartedClick={onGetStartedClick}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />

      <Routes>
        <Route path="/signin" element={<SignIn onSignIn={handleSignIn} onSwitchToRegister={() => navigate('/register')} />} />
        <Route path="/register" element={<Register onRegister={handleRegister} onSwitchToLogin={() => navigate('/signin')} />} />
        <Route path="/" element={user ? <Home user={user} onLogout={handleLogout} /> : <Navigate to="/signin" replace />} />
      </Routes>
    </>
  )
}

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}

export default App