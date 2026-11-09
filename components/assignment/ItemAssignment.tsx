'use client';

import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { Assignment, Item, ItemPortion, SplitType } from '@/lib/types/meal';
import { formatCurrency } from '@/lib/utils/helpers';
import { personColor } from '@/lib/utils/person-color';
import PersonAvatar from '@/components/ui/PersonAvatar';

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
  // Tap-to-assign: the item currently picked, whose people can be toggled below it.
  const [selectedPortionId, setSelectedPortionId] = useState<string | null>(null);

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
      <div className="card p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">Who had what?</h2>
        <p className="text-ink-muted mt-2">
          {meal?.items.length === 0 ? 'Add the items from the receipt first.' : 'Add the people at the table first.'}
        </p>
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

  const clearPortionAssignments = (itemId: string, portionId: string) => {
    updateItemPortions(itemId, (portions) =>
      portions.map((portion) => (portion.id === portionId ? { ...portion, assignments: [] } : portion))
    );
  };

  const toggleDiner = (itemId: string, portionId: string, dinerId: string, assigned: boolean) => {
    if (assigned) removePortionAssignment(itemId, portionId, dinerId);
    else assignPortionToDiner(itemId, portionId, dinerId);
  };

  const toggleSplitAll = (itemId: string, portionId: string, isCurrentlyAssignedToAll: boolean) => {
    if (isCurrentlyAssignedToAll) {
      clearPortionAssignments(itemId, portionId);
    } else {
      assignPortionToAllDiners(itemId, portionId);
    }
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

  const dinerIndex = new Map(meal.diners.map((d, i) => [d.id, i]));
  const unassignedCount = portionEntries.filter((p) => p.assignments.length === 0).length;
  const selected = portionEntries.find((p) => p.portionId === selectedPortionId) ?? null;

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">Who had what?</h2>
      <p className="text-sm text-ink-muted mt-0.5 mb-4">
        Tap an item, then tap everyone who had it. You can also drag items onto people below.
      </p>

      {/* Items */}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-semibold text-ink">Items</h3>
        <span className={`text-sm ${unassignedCount ? 'text-[#b8432b] font-medium' : 'text-ink-muted'}`}>
          {unassignedCount ? `${unassignedCount} still need someone` : 'All assigned'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {portionEntries.map((portion) => {
          const isAssigned = portion.assignments.length > 0;
          const isSelected = selectedPortionId === portion.portionId;
          const isDragging = draggingPortionId === portion.portionId;
          return (
            <div
              key={portion.portionId}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              draggable
              onDragStart={handleDragStart(portion.itemId, portion.portionId)}
              onDragEnd={handleDragEnd}
              onClick={() => setSelectedPortionId(isSelected ? null : portion.portionId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedPortionId(isSelected ? null : portion.portionId);
                }
              }}
              className={`relative text-left rounded-lg px-3 py-2.5 cursor-pointer select-none transition-colors border-[1.5px]
                ${isDragging ? 'opacity-50' : ''}
                ${isSelected
                  ? 'border-ink bg-white'
                  : isAssigned
                  ? 'border-rule bg-white hover:border-stone-400'
                  : 'border-dashed border-[#d2553b] bg-[#fdf3f0] hover:bg-[#fbe9e4]'}`}
            >
              <p className="text-[15px] font-medium text-ink leading-snug line-clamp-2">{portion.itemName}</p>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="money text-sm text-ink-muted">
                  {formatCurrency(portion.amount)}
                  {portion.portionCount > 1 && <span className="font-sans tracking-normal"> · {portion.portionIndex} of {portion.portionCount}</span>}
                </span>
                {isAssigned ? (
                  <span className="flex -space-x-1">
                    {portion.assignments.slice(0, 5).map((a) => (
                      <span
                        key={a.dinerId}
                        className="w-3 h-3 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: personColor(dinerIndex.get(a.dinerId) ?? 0) }}
                      />
                    ))}
                    {portion.assignments.length > 5 && <span className="text-[11px] text-ink-muted pl-1.5">+{portion.assignments.length - 5}</span>}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[#b8432b]">No one yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tap-to-assign panel for the picked item */}
      {selected && (
        <div className="mt-3 rounded-lg bg-paper-shade p-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <p className="text-sm text-ink">
              Who had <span className="font-semibold">{selected.itemName}</span>
              {selected.portionCount > 1 && ` (${selected.portionIndex} of ${selected.portionCount})`}?
            </p>
            <button onClick={() => setSelectedPortionId(null)} className="text-sm font-medium text-ink-muted hover:text-ink shrink-0">Done</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {meal.diners.map((diner, idx) => {
              const on = selected.assignments.some((a) => a.dinerId === diner.id);
              return (
                <button
                  key={diner.id}
                  onClick={() => toggleDiner(selected.itemId, selected.portionId, diner.id, on)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border-[1.5px] text-sm font-medium transition-colors ${
                    on ? 'text-white' : 'bg-white text-ink border-rule hover:border-stone-400'
                  }`}
                  style={on ? { backgroundColor: personColor(idx), borderColor: personColor(idx) } : undefined}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={on ? { backgroundColor: 'rgba(255,255,255,.22)' } : { backgroundColor: personColor(idx), color: '#fff' }}
                  >
                    {on ? '✓' : diner.name.charAt(0).toUpperCase()}
                  </span>
                  {diner.name}
                </button>
              );
            })}
            <button
              onClick={() => toggleSplitAll(selected.itemId, selected.portionId, selected.assignments.length === meal.diners.length)}
              className="px-3 py-1 rounded-full border-[1.5px] border-dashed border-stone-400 text-sm font-medium text-ink hover:bg-white"
            >
              {selected.assignments.length === meal.diners.length ? 'Clear' : 'Everyone'}
            </button>
          </div>
        </div>
      )}

      {/* People */}
      <h3 className="font-semibold text-ink mt-6 mb-2">People</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {meal.diners.map((diner, dinerIdx) => {
          const assignedPortions = portionEntries.filter((portion) =>
            portion.assignments.some((a) => a.dinerId === diner.id)
          );
          const totalAmount = assignedPortions.reduce((sum, p) => sum + p.amount / p.assignments.length, 0);
          const isDropTarget = activeBucketId === diner.id;

          return (
            <div
              key={diner.id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDragEnter={() => setActiveBucketId(diner.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveBucketId(null);
              }}
              onDrop={handleDrop(diner.id)}
              className={`rounded-lg border-[1.5px] bg-white p-3 transition-colors ${isDropTarget ? 'border-ink bg-paper-shade' : 'border-rule'}`}
              style={{ borderLeftColor: personColor(dinerIdx), borderLeftWidth: 4 }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <PersonAvatar name={diner.name} index={dinerIdx} size="sm" />
                <p className="flex-1 min-w-0 font-semibold text-ink truncate">{diner.name}</p>
                <p className="money text-[15px] font-medium text-ink">{formatCurrency(totalAmount)}</p>
              </div>
              {assignedPortions.length === 0 ? (
                <p className="text-sm text-ink-muted py-1">Nothing yet</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {assignedPortions.map((portion) => (
                    <li
                      key={`${diner.id}-${portion.portionId}`}
                      className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-paper-shade text-[13px] text-ink"
                    >
                      <span className="max-w-[9rem] truncate">{portion.itemName}</span>
                      {portion.assignments.length > 1 && (
                        <span className="text-ink-muted">÷{portion.assignments.length}</span>
                      )}
                      <button
                        onClick={() => removePortionAssignment(portion.itemId, portion.portionId, diner.id)}
                        className="w-5 h-5 rounded-full text-stone-500 hover:bg-white hover:text-red-600 flex items-center justify-center"
                        aria-label={`Remove ${portion.itemName} from ${diner.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
