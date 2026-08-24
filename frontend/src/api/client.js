import { io } from 'socket.io-client';

const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('cinepass_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('cinepass_token', token);
  } else {
    localStorage.removeItem('cinepass_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API Request failed');
  }

  return data;
}

// Socket.io connection helper
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}
