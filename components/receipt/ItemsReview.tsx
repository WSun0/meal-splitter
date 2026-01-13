'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { Item } from '@/lib/types/meal';

export default function ItemsReview() {
  const { meal, addItem, updateItem, removeItem } = useMeal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Item>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', quantity: 1, amount: 0 });

  const handleStartEdit = (item: Item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, quantity: item.quantity, amount: item.amount, isUncertain: item.isUncertain });
  };

  const handleSaveEdit = () => {
    if (editingId && editForm.name && editForm.quantity && editForm.amount !== undefined) {
      updateItem(editingId, { name: editForm.name, quantity: editForm.quantity, amount: editForm.amount, isUncertain: editForm.isUncertain });
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setNewItemForm({ name: '', quantity: 1, amount: 0 });
  };

  const handleSaveNewItem = () => {
    if (newItemForm.name.trim() && newItemForm.amount > 0) {
      addItem({
        name: newItemForm.name.trim(),
        quantity: newItemForm.quantity || 1,
        amount: newItemForm.amount,
        assignments: [],
      });
      setIsAdding(false);
      setNewItemForm({ name: '', quantity: 1, amount: 0 });
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItemForm({ name: '', quantity: 1, amount: 0 });
  };

  if (!meal) {
    return null;
  }

  if (meal.items.length === 0 && !isAdding) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Items Review</h2>
            <p className="text-sm text-stone-500">Review and edit your items</p>
          </div>
        </div>
        <div className="text-center py-12 px-4 rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-stone-600 font-medium mb-1">No items yet</p>
          <p className="text-sm text-stone-400 mb-4">Upload a receipt or add items manually</p>
          <button
            onClick={handleStartAdd}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item Manually
          </button>
        </div>
      </div>
    );
  }

  // Show adding form even when no items exist
  if (meal.items.length === 0 && isAdding) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Items Review</h2>
            <p className="text-sm text-stone-500">Add your first item</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-primary-50 border-2 border-primary-200 ring-2 ring-primary-400 ring-offset-2">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-6">
                <input
                  type="text"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  className="input"
                  placeholder="Item name"
                  autoFocus
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  min="1"
                  value={newItemForm.quantity}
                  onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseInt(e.target.value, 10) || 1 })}
                  className="input text-center"
                  placeholder="Qty"
                />
              </div>
              <div className="col-span-8 sm:col-span-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItemForm.amount || ''}
                    onChange={(e) => setNewItemForm({ ...newItemForm, amount: parseFloat(e.target.value) || 0 })}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={handleCancelAdd} className="btn-ghost text-sm py-2 px-4">Cancel</button>
              <button
                onClick={handleSaveNewItem}
                disabled={!newItemForm.name.trim() || newItemForm.amount <= 0}
                className="btn-primary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Items Review</h2>
          <p className="text-sm text-stone-500">{meal.items.length} item{meal.items.length !== 1 ? 's' : ''} • Click to edit</p>
        </div>
      </div>

      <div className="space-y-3">
        {meal.items.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl transition-all duration-200 ${
              item.isUncertain 
                ? 'bg-amber-50 border-2 border-amber-200' 
                : 'bg-stone-50 border-2 border-transparent hover:border-stone-200'
            } ${editingId === item.id ? 'ring-2 ring-primary-400 ring-offset-2' : ''}`}
          >
            {editingId === item.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-6">
                    <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input" placeholder="Item name" autoFocus />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" min="1" value={editForm.quantity || 1} onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value, 10) })} className="input text-center" />
                  </div>
                  <div className="col-span-8 sm:col-span-4">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                      <input type="number" step="0.01" min="0" value={editForm.amount || 0} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })} className="input pl-7" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={handleCancelEdit} className="btn-ghost text-sm py-2 px-4">Cancel</button>
                  <button onClick={handleSaveEdit} className="btn-primary text-sm py-2 px-4">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-800 truncate">{item.name}</p>
                    {item.isUncertain && <span className="badge badge-warning text-xs">Check</span>}
                  </div>
                  <p className="text-sm text-stone-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-xl font-bold text-stone-800">${item.amount.toFixed(2)}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleStartEdit(item)} className="p-2 rounded-xl text-stone-400 hover:text-primary-600 hover:bg-primary-50 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => removeItem(item.id)} className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add New Item Form */}
        {isAdding ? (
          <div className="p-4 rounded-2xl bg-primary-50 border-2 border-primary-200 ring-2 ring-primary-400 ring-offset-2">
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-6">
                  <input
                    type="text"
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                    className="input"
                    placeholder="Item name"
                    autoFocus
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="input text-center"
                    placeholder="Qty"
                  />
                </div>
                <div className="col-span-8 sm:col-span-4">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newItemForm.amount || ''}
                      onChange={(e) => setNewItemForm({ ...newItemForm, amount: parseFloat(e.target.value) || 0 })}
                      className="input pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={handleCancelAdd} className="btn-ghost text-sm py-2 px-4">Cancel</button>
                <button
                  onClick={handleSaveNewItem}
                  disabled={!newItemForm.name.trim() || newItemForm.amount <= 0}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartAdd}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-stone-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all duration-200 flex items-center justify-center gap-2 text-stone-500 hover:text-primary-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">Add Item</span>
          </button>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-stone-100">
        <div className="flex justify-between items-center">
          <span className="text-stone-600 font-medium">Items Total</span>
          <span className="text-3xl font-bold gradient-text">
            ${meal.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
