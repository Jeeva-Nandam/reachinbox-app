import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ComposeEmail } from "../emails/ComposeEmail";

export interface DashboardOutletContext {
  openCompose: () => void;
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCompose={() => {
          setComposeOpen(true);
          setSidebarOpen(false);
        }}
      />
      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <Header onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 p-4 sm:p-6">
          <Outlet context={{ openCompose: () => setComposeOpen(true) } satisfies DashboardOutletContext} />
        </main>
      </div>

      <ComposeEmail isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
