import { useAuth } from "../../context/AuthContext";

export function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();

  return (
    <button
      type="button"
      onClick={loginWithGoogle}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5
                 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.24 21.3 7.28 24 12 24z"
        />
        <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 010-4.54v-3.1H1.27a12 12 0 000 10.74l4-3.1z" />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.27 6.63l4 3.1C6.22 6.86 8.87 4.75 12 4.75z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
