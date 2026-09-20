import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GoogleLoginButton } from "../components/auth/GoogleLoginButton";
import { Button } from "../components/ui/Button";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const { isAuthenticated, isLoading, loginAsDev } = useAuth();
  const [devLoggingIn, setDevLoggingIn] = useState(false);
  const { showToast } = useToast();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDevLogin = async () => {
    setDevLoggingIn(true);
    try {
      await loginAsDev();
    } catch {
      showToast(
        "Dev login isn't available on this backend (only works when NODE_ENV=development and DEV_AUTH_BYPASS=true).",
        "error"
      );
    } finally {
      setDevLoggingIn(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            R
          </div>
          <h1 className="text-xl font-semibold text-gray-900">ReachInbox</h1>
          <p className="mt-1 text-sm text-gray-500">Welcome back</p>
        </div>

        <GoogleLoginButton />

        <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          local testing
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <Button
          variant="secondary"
          className="mt-4 w-full"
          isLoading={devLoggingIn}
          onClick={handleDevLogin}
        >
          Use local dev login
        </Button>
        <p className="mt-2 text-center text-xs text-gray-400">
          Only works against a backend running with DEV_AUTH_BYPASS enabled.
        </p>
      </div>
    </div>
  );
}
