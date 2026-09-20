import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ScheduledEmailsPage } from "./pages/ScheduledEmailsPage";
import { SentEmailsPage } from "./pages/SentEmailsPage";
import { SearchPage } from "./pages/SearchPage";
import { SlackPage } from "./pages/SlackPage";
import { ProtectedRoute } from "./router/ProtectedRoute";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="scheduled" replace />} />
          <Route path="scheduled" element={<ScheduledEmailsPage />} />
          <Route path="sent" element={<SentEmailsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="slack" element={<SlackPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
