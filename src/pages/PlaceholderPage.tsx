import React from 'react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
      <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500 max-w-md">
        Esta funcionalidade está em desenvolvimento e estará disponível em breve.
      </p>
    </div>
  );
}
