import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const SamlCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      localStorage.setItem('orion_access_token', accessToken);
      localStorage.setItem('orion_refresh_token', refreshToken);
      toast.success('Successfully authenticated via SAML SSO!');
      window.dispatchEvent(new Event('storage'));
      navigate('/');
    } else {
      toast.error('SAML authentication failed: missing token responses.');
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="space-y-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground font-semibold">Finalizing SSO authentication...</p>
      </div>
    </div>
  );
};

export default SamlCallbackPage;
