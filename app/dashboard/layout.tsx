import React from 'react';
import DashboardSidebar from './components/DashboardSidebar';
import AiAssistant from './components/AiAssistant';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-h-screen bg-thubpay-obsidian relative overflow-hidden">
      {/* Sidebar - hidden on mobile, fixed on desktop */}
      <div className="hidden lg:block">
        <DashboardSidebar />
      </div>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>

      {/* Floating AI Assistant */}
      <AiAssistant />
    </div>
  );
}
