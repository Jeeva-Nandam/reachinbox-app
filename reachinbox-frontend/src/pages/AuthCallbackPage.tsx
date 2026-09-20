import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/ui/Spinner";

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    const error = params.get("error");

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }
    if (!token) {
      navigate("/login?error=missing_token", { replace: true });
      return;
    }

    setToken(token);
    refreshUser().finally(() => navigate("/dashboard", { replace: true }));
  }, [params, navigate, refreshUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
        <Spinner size={28} />
        Signing you in…
      </div>
    </div>
  );
}
