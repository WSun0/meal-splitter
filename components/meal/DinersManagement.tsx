'use client';

import PersonAvatar from '@/components/ui/PersonAvatar';
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

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">Who&apos;s splitting?</h2>
      <p className="text-sm text-ink-muted mt-0.5 mb-4">Add everyone at the table, including whoever paid.</p>

      <form onSubmit={handleAddDiner} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newDinerName}
          onChange={(e) => setNewDinerName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          className="input flex-1"
          autoFocus={meal.diners.length === 0}
        />
        <button type="submit" className="btn-primary px-5">Add</button>
      </form>

      {meal.diners.length > 0 && (
        <ul className="border-t border-rule">
          {meal.diners.map((diner, index) => (
            <li key={diner.id} className="flex items-center gap-3 py-2.5 border-b border-rule">
              {editingId === diner.id ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input flex-1"
                    aria-label={`Rename ${diner.name}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <button onClick={handleSaveEdit} className="btn-primary py-2 px-4 text-sm">Save</button>
                  <button onClick={handleCancelEdit} className="btn-ghost py-2 px-4 text-sm">Cancel</button>
                </>
              ) : (
                <>
                  <PersonAvatar name={diner.name} index={index} />
                  <button
                    onClick={() => handleStartEdit(diner.id, diner.name)}
                    className="flex-1 text-left font-medium text-ink hover:underline underline-offset-2 decoration-rule-dashed"
                    aria-label={`Rename ${diner.name}`}
                  >
                    {diner.name}
                  </button>
                  <button
                    onClick={() => removeDiner(diner.id)}
                    aria-label={`Remove ${diner.name}`}
                    className="p-2 -mr-2 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-muted mt-3">
        {meal.diners.length === 0
          ? 'Add at least one person to continue.'
          : `${meal.diners.length} ${meal.diners.length === 1 ? 'person' : 'people'} · tap a name to rename`}
      </p>
    </div>
  );
}
