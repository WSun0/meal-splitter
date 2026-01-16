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

  const assignPortionToAllDiners = (itemId: string, portionId: string) => {
    const assignments: Assignment[] = meal.diners.map((d) => ({ dinerId: d.id, splitType: 'even' as SplitType }));
    updateItemPortions(itemId, (portions) =>
      portions.map((portion) => (portion.id === portionId ? { ...portion, assignments } : portion))
    );
  };

  const portionEntries: PortionEntry[] = [];

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

  const colors = [
    'from-rose-400 to-rose-600',
    'from-amber-400 to-amber-600',
    'from-emerald-400 to-emerald-600',
    'from-sky-400 to-sky-600',
    'from-violet-400 to-violet-600',
    'from-fuchsia-400 to-fuchsia-600',
  ];

  return (
    <div className="card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Assign Items</h2>
          <p className="text-sm text-stone-500">Drag items into multiple buckets to split costs · Red = unassigned</p>
        </div>
      </div>

      {/* TOP: Food Items Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Food Items</h3>
          <span className="text-xs text-stone-400">{portionEntries.length} portion{portionEntries.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {portionEntries.map((portion) => {
            const isAssigned = portion.assignments.length > 0;
            const isDragging = draggingPortionId === portion.portionId;

            return (
              <div
                key={portion.portionId}
                draggable
                onDragStart={handleDragStart(portion.itemId, portion.portionId)}
                onDragEnd={handleDragEnd}
                className={`
                  group relative flex flex-col items-center justify-center
                  w-20 h-20 rounded-xl cursor-grab active:cursor-grabbing
                  transition-all duration-200
                  ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-105 hover:shadow-lg'}
                  ${isAssigned
                    ? 'bg-white border-2 border-stone-200 shadow-sm'
                    : 'bg-red-50 border-2 border-red-400 shadow-md shadow-red-100'
                  }
                `}
              >
                {/* Item icon */}
                <div className={`text-2xl mb-0.5 ${isAssigned ? 'grayscale-0' : ''}`}>
                  🍽️
                </div>
                {/* Item name (truncated) */}
                <p className="text-[10px] font-semibold text-stone-700 text-center leading-tight px-1 truncate max-w-full">
                  {portion.itemName}
                </p>
                {/* Price */}
                <p className="text-[9px] text-stone-500">{formatCurrency(portion.amount)}</p>
                {/* Portion number badge */}
                {portion.portionCount > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-stone-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {portion.portionIndex}
                  </span>
                )}
                {/* Assignment count indicator */}
                {isAssigned && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow">
                    {portion.assignments.length}
                  </span>
                )}
                {/* Split among all button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    assignPortionToAllDiners(portion.itemId, portion.portionId);
                  }}
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-primary-500 text-white text-[10px] font-bold 
                             flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity
                             hover:bg-primary-600 hover:scale-110"
                  title="Split among all"
                >
                  ∀
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-xs text-stone-400 font-medium">↓ Drag items below ↓</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      {/* BOTTOM: Diner Buckets */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide">Diners</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meal.diners.map((diner, dinerIdx) => {
            const assignedPortions = portionEntries.filter((portion) =>
              portion.assignments.some((a) => a.dinerId === diner.id)
            );
            const totalAmount = assignedPortions.reduce((sum, p) => sum + p.amount / p.assignments.length, 0);

            return (
              <div
                key={diner.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }}
                onDragEnter={() => setActiveBucketId(diner.id)}
                onDragLeave={(e) => {
                  // Only clear if leaving the bucket entirely
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setActiveBucketId(null);
                  }
                }}
                onDrop={handleDrop(diner.id)}
                className={`
                  rounded-2xl border-2 border-dashed p-4 transition-all duration-200
                  ${activeBucketId === diner.id
                    ? 'border-primary-400 bg-primary-50 scale-[1.02] shadow-lg'
                    : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                  }
                `}
              >
                {/* Bucket header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[dinerIdx % colors.length]} text-white font-bold flex items-center justify-center shadow-md`}>
                    {diner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 truncate">{diner.name}</p>
                    <p className="text-xs text-stone-500">
                      {assignedPortions.length} item{assignedPortions.length !== 1 ? 's' : ''} · {formatCurrency(totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Bucket contents */}
                <div className="min-h-[80px]">
                  {assignedPortions.length === 0 ? (
                    <div className="h-[80px] flex items-center justify-center">
                      <p className="text-xs text-stone-400">Drop items here</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedPortions.map((portion) => (
                        <div
                          key={`${diner.id}-${portion.portionId}`}
                          className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-stone-200 shadow-sm"
                        >
                          <span className="text-xs">🍽️</span>
                          <span className="text-[11px] font-medium text-stone-700 max-w-[60px] truncate">
                            {portion.itemName}
                          </span>
                          {portion.portionCount > 1 && (
                            <span className="text-[9px] text-stone-400">#{portion.portionIndex}</span>
                          )}
                          <button
                            onClick={() => removePortionAssignment(portion.itemId, portion.portionId, diner.id)}
                            className="w-4 h-4 rounded-full bg-stone-100 text-stone-400 hover:bg-red-100 hover:text-red-500 
                                       flex items-center justify-center text-[10px] transition-colors"
                            aria-label={`Remove ${portion.itemName}`}
                          >
                            ×
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
  );
}
