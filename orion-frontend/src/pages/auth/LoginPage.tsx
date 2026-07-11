import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { authService } from '../../services/auth-service';
import api from '../../lib/api';
import { Input, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui';
import { Layers, Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { useSystemSettingsStore } from '../../stores/system-settings-store';

export const LoginPage: React.FC = () => {
  const { getSetting } = useSystemSettingsStore();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const platformName = getSetting('platform.name', 'ORION');
  const tagline = getSetting('platform.tagline', 'Sign in to manage and execute your visual test cases');

  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authService.login(usernameOrEmail, password);
      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      {/* Login box */}
      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-2 font-bold text-2xl bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            <Layers className="h-8 w-8 text-primary animate-pulse" />
            <span>{platformName}</span>
          </div>
        </div>

        <Card className="backdrop-blur-md bg-card/60 border border-border/80 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {tagline}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center space-x-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Username or Email</label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="admin or admin@orion.local"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    required
                    className="pl-3"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                </div>
                <div className="relative flex items-center">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-3 pr-10 w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-border/40"></div>
              <span className="flex-shrink mx-4 text-muted-foreground text-[10px] font-extrabold uppercase tracking-wider">or sign in with</span>
              <div className="flex-grow border-t border-border/40"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = `${api.defaults.baseURL || ''}/saml2/authorization-request/orion`;
              }}
              className="w-full h-10 border-dashed hover:border-primary hover:text-primary flex items-center justify-center gap-2 font-bold"
            >
              <Shield className="h-4 w-4" /> Single Sign-On (SAML SSO)
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <div className="text-sm text-center text-muted-foreground mt-2">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-semibold">
                Create Account
              </Link>
            </div>
            <div className="text-xs text-center text-muted-foreground/60 border-t border-border/40 pt-4 w-full">
              Demo Credentials: admin / Admin@123
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
export default LoginPage;
