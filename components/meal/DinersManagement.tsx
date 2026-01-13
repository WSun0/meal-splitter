'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';

export default function DinersManagement() {
  const { meal, addDiner, removeDiner, updateDiner } = useMeal();
  const [newDinerName, setNewDinerName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAddDiner = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDinerName.trim()) {
      addDiner(newDinerName.trim());
      setNewDinerName('');
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      updateDiner(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (!meal) return null;

  const colors = ['from-primary-400 to-primary-600', 'from-secondary-400 to-secondary-600', 'from-amber-400 to-amber-600', 'from-violet-400 to-violet-600', 'from-cyan-400 to-cyan-600'];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center shadow-lg shadow-secondary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Who's splitting?</h2>
          <p className="text-sm text-stone-500">Add everyone sharing the bill</p>
        </div>
      </div>

      <form onSubmit={handleAddDiner} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newDinerName}
            onChange={(e) => setNewDinerName(e.target.value)}
            placeholder="Enter name..."
            className="input flex-1"
          />
          <button type="submit" className="btn-secondary px-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </form>

      {meal.diners.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197h3" />
            </svg>
          </div>
          <p className="text-stone-600 font-medium mb-1">No diners yet</p>
          <p className="text-sm text-stone-400">Add at least one person to continue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meal.diners.map((diner, index) => (
            <div
              key={diner.id}
              className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl group hover:bg-stone-100 transition-all duration-200"
            >
              {editingId === diner.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <button onClick={handleSaveEdit} className="btn-secondary py-2 px-4 text-sm">
                    Save
                  </button>
                  <button onClick={handleCancelEdit} className="btn-ghost py-2 px-4 text-sm">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[index % colors.length]} text-white font-bold text-lg flex items-center justify-center shadow-md`}>
                    {diner.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-semibold text-stone-800">{diner.name}</span>
                  <button
                    onClick={() => handleStartEdit(diner.id, diner.name)}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeDiner(diner.id)}
                    className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {meal.diners.length > 0 && (
        <div className="mt-6 pt-4 border-t border-stone-100">
          <p className="text-sm text-stone-400 text-center">
            {meal.diners.length} {meal.diners.length === 1 ? 'person' : 'people'} added
          </p>
        </div>
      )}
    </div>
  );
}
