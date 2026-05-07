import { defineStore } from 'pinia';
import http from '@/api/http';

const TOKEN_KEY = 'sc_erp_token';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: null,
  }),
  actions: {
    async login(username, password) {
      const data = await http.post('/api/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem(TOKEN_KEY, data.token);
      return data;
    },
    async fetchMe() {
      if (!this.token) return null;
      try {
        this.user = await http.get('/api/auth/me');
        return this.user;
      } catch {
        this.clear();
        return null;
      }
    },
    clear() {
      this.token = '';
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    logout() {
      this.clear();
    },
  },
});
