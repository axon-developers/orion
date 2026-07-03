import api from '../lib/api';
import { LoginResponse, TokenResponse } from '../types/auth';

export const authService = {
  async login(usernameOrEmail: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', {
      usernameOrEmail,
      password,
    });
    return response.data;
  },

  async register(username: string, email: string, password: string, fullName: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/register', {
      username,
      email,
      password,
      fullName,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('orion_access_token');
      localStorage.removeItem('orion_refresh_token');
      localStorage.removeItem('orion_user');
    }
  },
};
