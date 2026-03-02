import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
export const API_URL = rawApiUrl ? rawApiUrl.replace(/\/$/, '') : '';

export const api = axios.create({ baseURL: `${API_URL}/api` });

export const adminApi = (token) => axios.create({
  baseURL: `${API_URL}/api/admin`,
  headers: { Authorization: `Bearer ${token}` }
});
