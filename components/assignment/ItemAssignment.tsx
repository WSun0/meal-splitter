'use client';

import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { Assignment, Item, ItemPortion, SplitType } from '@/lib/types/meal';
import { formatCurrency } from '@/lib/utils/helpers';

interface PortionEntry {
  itemId: string;
  portionId: string;
  itemName: string;
  portionIndex: number;
  portionCount: number;
  amount: number;
  assignments: Assignment[];
}

export default function ItemAssignment() {
  const { meal, updateItem } = useMeal();
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null);
  const [draggingPortionId, setDraggingPortionId] = useState<string | null>(null);

  if (!meal || meal.diners.length === 0 || meal.items.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-800">Assign Items</h2>
            <p className="text-sm text-stone-500">Drag items into each diner&apos;s bucket</p>
          </div>
        </div>
        <div className="text-center py-12 px-4 rounded-2xl bg-stone-50 border-2 border-dashed border-stone-200">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <p className="text-stone-600 font-medium mb-1">{meal?.diners.length === 0 ? 'No diners yet' : 'No items yet'}</p>
          <p className="text-sm text-stone-400">Add {meal?.diners.length === 0 ? 'diners' : 'items'} first to assign</p>
        </div>
      </div>
    );
  }

  const getExpectedQuantity = (item: Item) => Math.max(1, Math.round(item.quantity || 1));

  const buildPortions = (item: Item): ItemPortion[] => {
    const expectedQuantity = getExpectedQuantity(item);
    return Array.from({ length: expectedQuantity }, (_, index) => ({
      id: item.portions?.[index]?.id ?? `${item.id}-portion-${index + 1}`,
      assignments: item.portions?.[index]?.assignments
        ?? item.assignments.map((assignment) => ({ ...assignment })),
    }));
  };

  const getPortionsForItem = (item: Item): ItemPortion[] => {
    if (item.portions && item.portions.length > 0) {
      return item.portions;
    }
    return buildPortions(item);
  };

  useEffect(() => {
    if (!meal) return;
    meal.items.forEach((item) => {
      const expectedQuantity = getExpectedQuantity(item);
      if (!item.portions || item.portions.length !== expectedQuantity) {
        updateItem(item.id, { portions: buildPortions(item) });
      }
    });
  }, [meal, updateItem]);

  const updateItemPortions = (itemId: string, updater: (portions: ItemPortion[]) => ItemPortion[]) => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item) return;
    const portions = getPortionsForItem(item);
    updateItem(itemId, { portions: updater(portions) });
  };

  const assignPortionToDiner = (itemId: string, portionId: string, dinerId: string) => {
    updateItemPortions(itemId, (portions) =>
      portions.map((portion) => {
        if (portion.id !== portionId) return portion;
        if (portion.assignments.some((a) => a.dinerId === dinerId)) {
          return portion;
        }
        return {
          ...portion,
          assignments: [...portion.assignments, { dinerId, splitType: 'even' as SplitType }],
        };
      })
    );
  };

  const removePortionAssignment = (itemId: string, portionId: string, dinerId: string) => {
    updateItemPortions(itemId, (portions) =>
      portions.map((portion) => (
        portion.id === portionId
          ? { ...portion, assignments: portion.assignments.filter((a) => a.dinerId !== dinerId) }
          : portion
      ))
    );
  };

  const assignItemToAllDiners = (itemId: string) => {
    const assignments: Assignment[] = meal.diners.map((d) => ({ dinerId: d.id, splitType: 'even' as SplitType }));
    updateItemPortions(itemId, (portions) => portions.map((portion) => ({ ...portion, assignments })));
  };

  const clearItemAssignments = (itemId: string) => {
    updateItemPortions(itemId, (portions) => portions.map((portion) => ({ ...portion, assignments: [] })));
  };

  const portionEntries: PortionEntry[] = [];
  const portionsByItemId = new Map<string, PortionEntry[]>();

  meal.items.forEach((item) => {
    const portions = getPortionsForItem(item);
    const portionCount = Math.max(1, portions.length);
    const unitAmount = item.amount / portionCount;
    const entries = portions.map((portion, index) => ({
      itemId: item.id,
      portionId: portion.id,
      itemName: item.name,
      portionIndex: index + 1,
      portionCount,
      amount: unitAmount,
      assignments: portion.assignments,
    }));
    portionEntries.push(...entries);
    portionsByItemId.set(item.id, entries);
  });

  const handleDragStart = (itemId: string, portionId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ itemId, portionId }));
    event.dataTransfer.effectAllowed = 'copy';
    setDraggingPortionId(portionId);
  };

  const handleDragEnd = () => {
    setDraggingPortionId(null);
    setActiveBucketId(null);
  };

  const handleDrop = (dinerId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('text/plain');
    if (!payload) return;
    try {
      const { itemId, portionId } = JSON.parse(payload) as { itemId: string; portionId: string };
      assignPortionToDiner(itemId, portionId, dinerId);
    } catch {
      return;
    } finally {
      setActiveBucketId(null);
      setDraggingPortionId(null);
    }
  };

  const colors = ['from-primary-400 to-primary-600', 'from-secondary-400 to-secondary-600', 'from-amber-400 to-amber-600', 'from-violet-400 to-violet-600', 'from-cyan-400 to-cyan-600'];

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Assign Items</h2>
          <p className="text-sm text-stone-500">Drag portions into buckets to split items</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Items</h3>
            <span className="text-xs text-stone-400">Drag into multiple buckets to split</span>
          </div>
          <div className="space-y-4">
            {meal.items.map((item) => {
              const entries = portionsByItemId.get(item.id) || [];
              const portionCount = Math.max(1, entries.length);
              const unitAmount = item.amount / portionCount;

              return (
                <div key={item.id} className="rounded-2xl border border-stone-200 bg-white">
                  <div className="p-4 border-b border-stone-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-800">{item.name}</p>
                        <p className="text-xs text-stone-500">
                          {portionCount} portion{portionCount > 1 ? 's' : ''} · {formatCurrency(unitAmount)} each
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-stone-600">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => assignItemToAllDiners(item.id)} className="flex-1 btn-ghost py-2 text-sm">
                        Split among all
                      </button>
                      <button onClick={() => clearItemAssignments(item.id)} className="flex-1 btn-ghost py-2 text-sm">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-stone-50">
                    {entries.map((portion) => {
                      const assignedNames = portion.assignments
                        .map((assignment) => meal.diners.find((d) => d.id === assignment.dinerId)?.name)
                        .filter(Boolean);

                      return (
                        <div
                          key={portion.portionId}
                          draggable
                          onDragStart={handleDragStart(portion.itemId, portion.portionId)}
                          onDragEnd={handleDragEnd}
                          className={`rounded-xl border px-3 py-2 bg-white shadow-sm transition-all ${
                            draggingPortionId === portion.portionId ? 'border-primary-400 shadow-primary-200' : 'border-stone-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {portion.itemName} <span className="text-xs text-stone-400">#{portion.portionIndex}</span>
                              </p>
                              <p className="text-xs text-stone-400">{formatCurrency(portion.amount)}</p>
                            </div>
                            <span className="text-xs text-stone-400">Drag</span>
                          </div>
                          {assignedNames.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {assignedNames.map((name) => (
                                <span key={name} className="badge badge-secondary text-[11px]">{name}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-stone-400">Drop into a bucket</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Buckets</h3>
            <span className="text-xs text-stone-400">Click ✕ to remove</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {meal.diners.map((diner, dinerIdx) => {
              const assignedPortions = portionEntries.filter((portion) =>
                portion.assignments.some((assignment) => assignment.dinerId === diner.id)
              );

              return (
                <div key={diner.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[dinerIdx % colors.length]} text-white font-bold text-sm flex items-center justify-center shadow-md`}>
                      {diner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-stone-800">{diner.name}</p>
                      <p className="text-xs text-stone-400">{assignedPortions.length} portion{assignedPortions.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                    }}
                    onDragEnter={() => setActiveBucketId(diner.id)}
                    onDragLeave={() => setActiveBucketId(null)}
                    onDrop={handleDrop(diner.id)}
                    className={`min-h-[140px] rounded-2xl border-2 border-dashed p-3 transition-colors ${
                      activeBucketId === diner.id ? 'border-primary-400 bg-primary-50/50' : 'border-stone-200 bg-stone-50'
                    }`}
                  >
                    {assignedPortions.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center mt-6">Drop portions here</p>
                    ) : (
                      <div className="space-y-2">
                        {assignedPortions.map((portion) => (
                          <div key={`${portion.itemId}-${portion.portionId}`} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-stone-800">
                                {portion.itemName} <span className="text-xs text-stone-400">#{portion.portionIndex}</span>
                              </p>
                              <p className="text-xs text-stone-400">{formatCurrency(portion.amount)}</p>
                            </div>
                            <button
                              onClick={() => removePortionAssignment(portion.itemId, portion.portionId, diner.id)}
                              className="text-stone-400 hover:text-stone-600"
                              type="button"
                              aria-label={`Remove ${portion.itemName} from ${diner.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
