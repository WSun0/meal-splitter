'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { formatCurrency } from '@/lib/utils/helpers';
import ItemForm, { ItemFormValues, PriceMode } from './ItemForm';

export default function ItemsReview() {
  const { meal, addItem, updateItem, removeItem } = useMeal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  // Remember whether the user last typed per-item or total prices.
  const [priceMode, setPriceMode] = useState<PriceMode>('each');

  const handleStartEdit = (id: string) => {
    setIsAdding(false);
    setEditingId(id);
  };

  const handleSaveEdit = (values: ItemFormValues, mode: PriceMode) => {
    if (editingId) updateItem(editingId, values);
    setPriceMode(mode);
    setEditingId(null);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setIsAdding(true);
  };

  const handleSaveNewItem = (values: ItemFormValues, mode: PriceMode) => {
    addItem({ ...values, assignments: [] });
    setPriceMode(mode);
    setIsAdding(false);
  };

  const addForm = (
    <ItemForm
      defaultPriceMode={priceMode}
      submitLabel="Add Item"
      onSubmit={handleSaveNewItem}
      onCancel={() => setIsAdding(false)}
    />
  );

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
          <p className="text-sm text-stone-400 mb-4">Add each item from the receipt</p>
          <button
            onClick={handleStartAdd}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
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
          {addForm}
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
              'bg-stone-50 border-2 border-transparent hover:border-stone-200'
            } ${editingId === item.id ? 'ring-2 ring-primary-400 ring-offset-2' : ''}`}
          >
            {editingId === item.id ? (
              <ItemForm
                initial={{ name: item.name, quantity: item.quantity, amount: item.amount }}
                defaultPriceMode={priceMode}
                submitLabel="Save"
                onSubmit={handleSaveEdit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-800 truncate">{item.name}</p>
                  </div>
                  <p className="text-sm text-stone-500">
                    {item.quantity > 1 ? `${item.quantity} × ${formatCurrency(item.amount / item.quantity)} each` : 'Qty 1'}
                  </p>
                </div>
                <p className="text-xl font-bold text-stone-800">{formatCurrency(item.amount)}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleStartEdit(item.id)} aria-label={`Edit ${item.name}`} className="p-2 rounded-xl text-stone-400 hover:text-primary-600 hover:bg-primary-50 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`} className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all">
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
            {addForm}
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
          <span className="text-3xl font-bold text-primary-600">
            ${meal.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
