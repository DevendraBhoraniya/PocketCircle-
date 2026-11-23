import { createContext } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  username: string | null;
  pocket_id: string;
  avatar_url: string | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<boolean>;
  logoutAll?: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
