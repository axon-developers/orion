export interface UserInfo {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TESTER' | 'VIEWER';
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}
