import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        const userData = await client.get('/auth/me');
        setUser(userData.user || userData);
      }
    } catch (err) {
      // Token is invalid or expired — clear it
      await AsyncStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await client.post('/auth/login', { email, password });
    const newToken = data.token;
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(data.user);
    return data;
  }

  async function signup(email, password, name, inviteCode) {
    const body = { email, password, name };
    if (inviteCode) {
      body.invite_code = inviteCode;
    }
    const data = await client.post('/auth/signup', body);
    const newToken = data.token;
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
