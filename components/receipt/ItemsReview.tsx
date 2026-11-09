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
      submitLabel="Add item"
      onSubmit={handleSaveNewItem}
      onCancel={() => setIsAdding(false)}
    />
  );

  if (!meal) {
    return null;
  }

  // No items yet: the form is the whole screen, already open.
  if (meal.items.length === 0) {
    return (
      <div className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">What did you order?</h2>
        <p className="text-sm text-ink-muted mt-0.5 mb-5">Add each item and its price from the receipt.</p>
        <ItemForm defaultPriceMode={priceMode} submitLabel="Add item" onSubmit={handleSaveNewItem} onCancel={() => {}} hideCancel />
      </div>
    );
  }

  const itemsTotal = meal.items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">What did you order?</h2>
      <p className="text-sm text-ink-muted mt-0.5 mb-4">
        {meal.items.length} item{meal.items.length !== 1 ? 's' : ''} · tap one to edit
      </p>

      <ul className="border-t border-rule">
        {meal.items.map((item) => (
          <li key={item.id} className="border-b border-rule">
            {editingId === item.id ? (
              <div className="py-4">
                <ItemForm
                  initial={{ name: item.name, quantity: item.quantity, amount: item.amount }}
                  defaultPriceMode={priceMode}
                  submitLabel="Save"
                  onSubmit={handleSaveEdit}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <button
                  onClick={() => handleStartEdit(item.id)}
                  aria-label={`Edit ${item.name}`}
                  className="flex-1 min-w-0 flex items-baseline gap-3 py-3 text-left"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-ink truncate group-hover:underline underline-offset-2 decoration-rule-dashed">{item.name}</span>
                    {item.quantity > 1 && (
                      <span className="block text-sm text-ink-muted">
                        {item.quantity} × <span className="money">{formatCurrency(item.amount / item.quantity)}</span> each
                      </span>
                    )}
                  </span>
                  <span className="money text-[17px] font-medium text-ink">{formatCurrency(item.amount)}</span>
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="p-2 -mr-2 rounded-full text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isAdding ? (
        <div className="mt-4 p-4 rounded-xl bg-paper-shade">{addForm}</div>
      ) : (
        <button
          onClick={handleStartAdd}
          className="w-full mt-3 py-3 rounded-xl border-[1.5px] border-dashed border-rule-dashed text-ink-muted hover:text-ink hover:border-ink transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add item
        </button>
      )}

      <hr className="rule-dashed mt-5 mb-3" />
      <div className="flex justify-between items-baseline">
        <span className="text-ink-muted">Items total</span>
        <span className="money text-2xl font-semibold text-ink">{formatCurrency(itemsTotal)}</span>
      </div>
    </div>
  );
}
