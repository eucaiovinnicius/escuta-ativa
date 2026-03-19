import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex min-h-screen bg-[#f6f7f8]">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
