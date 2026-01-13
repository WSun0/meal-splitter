'use client';

import { useState } from 'react';
import { useMeal } from '@/lib/store/meal-store';
import { Assignment, SplitType } from '@/lib/types/meal';

export default function ItemAssignment() {
  const { meal, updateItem } = useMeal();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
            <p className="text-sm text-stone-500">Choose who ate what</p>
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

  const toggleDinerForItem = (itemId: string, dinerId: string) => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item) return;
    const hasAssignment = item.assignments.some((a) => a.dinerId === dinerId);
    if (hasAssignment) {
      updateItem(itemId, { assignments: item.assignments.filter((a) => a.dinerId !== dinerId) });
    } else {
      updateItem(itemId, { assignments: [...item.assignments, { dinerId, splitType: 'even' as SplitType }] });
    }
  };

  const assignToAllDiners = (itemId: string) => {
    const assignments: Assignment[] = meal.diners.map((d) => ({ dinerId: d.id, splitType: 'even' as SplitType }));
    updateItem(itemId, { assignments });
  };

  const clearAssignments = (itemId: string) => updateItem(itemId, { assignments: [] });

  const updateSplitType = (itemId: string, dinerId: string, splitType: SplitType) => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item) return;
    if (splitType === 'single') {
      updateItem(itemId, { assignments: [{ dinerId, splitType: 'single' }] });
    } else {
      updateItem(itemId, {
        assignments: item.assignments.map((a) => a.dinerId === dinerId ? { ...a, splitType } : a),
      });
    }
  };

  const updateSplitValue = (itemId: string, dinerId: string, value: number) => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item) return;
    updateItem(itemId, { assignments: item.assignments.map((a) => a.dinerId === dinerId ? { ...a, value } : a) });
  };

  const getAssignmentSummary = (itemId: string): string => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item || item.assignments.length === 0) return 'Unassigned';
    if (item.assignments.length === meal.diners.length) return 'Everyone';
    return item.assignments.map((a) => meal.diners.find((d) => d.id === a.dinerId)?.name || '?').join(', ');
  };

  const getStatus = (itemId: string) => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item || item.assignments.length === 0) return 'unassigned';
    return item.assignments.length === meal.diners.length ? 'all' : 'partial';
  };

  const colors = ['from-primary-400 to-primary-600', 'from-secondary-400 to-secondary-600', 'from-amber-400 to-amber-600', 'from-violet-400 to-violet-600', 'from-cyan-400 to-cyan-600'];

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
          <p className="text-sm text-stone-500">Tap an item to assign diners</p>
        </div>
      </div>

      <div className="space-y-3">
        {meal.items.map((item) => {
          const isExpanded = expandedItemId === item.id;
          const summary = getAssignmentSummary(item.id);
          const status = getStatus(item.id);

          return (
            <div key={item.id} className={`rounded-2xl border-2 overflow-hidden transition-all duration-200 ${isExpanded ? 'border-primary-400 shadow-lg shadow-primary-500/10' : 'border-transparent bg-stone-50'}`}>
              <button
                className={`w-full flex items-center justify-between p-4 text-left transition-all ${isExpanded ? 'bg-gradient-to-r from-primary-50 to-primary-100/50' : 'hover:bg-stone-100'}`}
                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-stone-800">{item.name}</p>
                    <span className={`badge text-xs ${status === 'all' ? 'badge-secondary' : status === 'partial' ? 'badge-primary' : 'bg-stone-200 text-stone-600'}`}>
                      {summary}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500">${item.amount.toFixed(2)}</p>
                </div>
                <svg className={`w-5 h-5 text-stone-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="p-4 bg-white border-t border-stone-100 space-y-4">
                  <div className="flex gap-2">
                    <button onClick={() => assignToAllDiners(item.id)} className="flex-1 btn-ghost py-2.5 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Everyone
                    </button>
                    <button onClick={() => clearAssignments(item.id)} className="flex-1 btn-ghost py-2.5 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear
                    </button>
                  </div>

                  <div className="space-y-2">
                    {meal.diners.map((diner, dinerIdx) => {
                      const assignment = item.assignments.find((a) => a.dinerId === diner.id);
                      const isAssigned = !!assignment;

                      return (
                        <div key={diner.id} className={`rounded-2xl border-2 p-4 transition-all ${isAssigned ? 'border-primary-300 bg-primary-50/50' : 'border-stone-100 bg-stone-50 hover:border-stone-200'}`}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={isAssigned} onChange={() => toggleDinerForItem(item.id, diner.id)} />
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[dinerIdx % colors.length]} text-white font-bold text-sm flex items-center justify-center shadow-md`}>
                              {diner.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-stone-800">{diner.name}</span>
                          </label>

                          {isAssigned && assignment && (
                            <div className="mt-4 ml-12 pl-4 border-l-2 border-primary-200">
                              <div className="flex flex-wrap gap-2">
                                {(['single', 'even', 'shares'] as const).map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => updateSplitType(item.id, diner.id, type)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                      assignment.splitType === type
                                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                  >
                                    {type === 'single' ? 'Full' : type === 'even' ? 'Even' : 'Shares'}
                                  </button>
                                ))}
                              </div>

                              {assignment.splitType === 'shares' && (
                                <div className="mt-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={assignment.value || ''}
                                    onChange={(e) => updateSplitValue(item.id, diner.id, parseFloat(e.target.value) || 0)}
                                    placeholder="Shares"
                                    className="input w-full max-w-[180px]"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
