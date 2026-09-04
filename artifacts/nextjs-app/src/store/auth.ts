import { create } from 'zustand';
import { User } from '../lib/types';
import { storeAuth, clearAuth, getStoredUser, getStoredToken } from '../lib/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  updateProfile: (user: User) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (token, user) => {
    storeAuth(token, user);
    set({ token, user, isAuthenticated: true });
  },
  updateProfile: (user) => set((state) => {
    if (!state.token) return state;
    storeAuth(state.token, user);
    return { user };
  }),
  logout: () => {
    clearAuth();
    set({ token: null, user: null, isAuthenticated: false });
  },
  loadFromStorage: () => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      set({ token, user, isAuthenticated: true });
    }
  },
}));
