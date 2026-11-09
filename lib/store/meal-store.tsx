'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Meal, Diner, Item, Adjustment, ReceiptMeta } from '../types/meal';
import { generateId, safeJsonParse, todayLocalISODate } from '../utils/helpers';

export interface SavedDraft {
  meal: Meal;
  savedAt: number; // epoch ms
}

interface MealContextType {
  meal: Meal | null;
  /** A meal left over from a previous visit, offered on the landing page instead of auto-loading. */
  savedDraft: SavedDraft | null;
  resumeDraft: () => void;
  discardDraft: () => void;
  createMeal: (title: string, restaurant?: string, date?: string) => void;
  updateMealInfo: (updates: { title?: string; restaurant?: string; date?: string; payerId?: string | null; payerPayment?: { venmo?: string; zelle?: string } | null }) => void;
  addDiner: (name: string) => void;
  removeDiner: (dinerId: string) => void;
  updateDiner: (dinerId: string, name: string) => void;
  addItem: (item: Omit<Item, 'id'>) => void;
  updateItem: (itemId: string, updates: Partial<Item>) => void;
  removeItem: (itemId: string) => void;
  updateReceiptMeta: (meta: Partial<ReceiptMeta>) => void;
  addAdjustment: (adjustment: Omit<Adjustment, 'id'>) => void;
  removeAdjustment: (adjustmentId: string) => void;
  resetMeal: () => void;
}

const MealContext = createContext<MealContextType | undefined>(undefined);

const STORAGE_KEY = 'mealsplit-current-meal';
// Drafts older than this are dropped instead of offered for resume.
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storageGet(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storageSet(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage unavailable (private mode, quota): the app still works, just without resume
  }
}

/** Reads the saved draft. Handles the old format, which stored the bare Meal. */
export function parseSavedDraft(raw: string | null, now = Date.now()): SavedDraft | null {
  if (!raw) return null;
  const parsed = safeJsonParse<unknown>(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const wrapped = parsed as { meal?: Meal; savedAt?: number };
  const meal = (wrapped.meal ?? parsed) as Meal;
  if (!meal || !Array.isArray(meal.items) || !Array.isArray(meal.diners)) return null;
  const savedAt = typeof wrapped.savedAt === 'number' ? wrapped.savedAt : Date.parse(meal.createdAt) || 0;
  if (now - savedAt > DRAFT_MAX_AGE_MS) return null;
  if (meal.items.length === 0 && meal.diners.length === 0) return null; // nothing worth resuming
  return { meal, savedAt };
}

export function MealProvider({ children }: { children: ReactNode }) {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);

  // On open, never drop the user straight into the last meal. Offer it as a
  // draft on the landing page (if it's recent), otherwise clear it.
  useEffect(() => {
    const draft = parseSavedDraft(storageGet());
    if (draft) setSavedDraft(draft);
    else storageSet(null);
  }, []);

  // Persist the active meal so a refresh mid-split doesn't lose work.
  useEffect(() => {
    if (meal) storageSet(JSON.stringify({ meal, savedAt: Date.now() }));
  }, [meal]);

  const resumeDraft = () => {
    if (savedDraft) setMeal(savedDraft.meal);
    setSavedDraft(null);
  };

  const discardDraft = () => {
    setSavedDraft(null);
    storageSet(null);
  };

  const createMeal = (title: string, restaurant?: string, date?: string) => {
    setSavedDraft(null);
    const now = new Date().toISOString();
    const newMeal: Meal = {
      id: generateId(),
      title,
      restaurant,
      date: date || todayLocalISODate(),
      createdAt: now,
      diners: [],
      items: [],
      receiptMeta: {
        subtotal: 0,
        tax: 0,
        tip: 0,
        fees: [],
        discounts: [],
        total: 0,
      },
      adjustments: [],
    };
    setMeal(newMeal);
  };

  const updateMealInfo = (updates: { title?: string; restaurant?: string; date?: string; payerId?: string | null; payerPayment?: { venmo?: string; zelle?: string } | null }) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.restaurant !== undefined && { restaurant: updates.restaurant }),
        ...(updates.date !== undefined && { date: updates.date }),
        ...(updates.payerId !== undefined && { payerId: updates.payerId ?? undefined }),
        ...(updates.payerPayment !== undefined && { payerPayment: updates.payerPayment ?? undefined }),
      };
    });
  };

  const addDiner = (name: string) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      const newDiner: Diner = {
        id: generateId(),
        name,
      };
      return {
        ...prevMeal,
        diners: [...prevMeal.diners, newDiner],
      };
    });
  };

  const removeDiner = (dinerId: string) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      // Remove diner and their assignments from all items
      const updatedItems = prevMeal.items.map((item) => ({
        ...item,
        assignments: item.assignments.filter((a) => a.dinerId !== dinerId),
        portions: item.portions?.map((portion) => ({
          ...portion,
          assignments: portion.assignments.filter((a) => a.dinerId !== dinerId),
        })),
      }));
      return {
        ...prevMeal,
        diners: prevMeal.diners.filter((d) => d.id !== dinerId),
        items: updatedItems,
        adjustments: prevMeal.adjustments.filter((adj) => adj.personId !== dinerId),
        payerId: prevMeal.payerId === dinerId ? undefined : prevMeal.payerId,
      };
    });
  };

  const updateDiner = (dinerId: string, name: string) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        diners: prevMeal.diners.map((d) => (d.id === dinerId ? { ...d, name } : d)),
      };
    });
  };

  const addItem = (item: Omit<Item, 'id'>) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      const newItem: Item = {
        ...item,
        id: generateId(),
      };
      return {
        ...prevMeal,
        items: [...prevMeal.items, newItem],
      };
    });
  };

  const updateItem = (itemId: string, updates: Partial<Item>) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        items: prevMeal.items.map((item) =>
          item.id === itemId
            ? {
              ...item,
              ...updates,
              ...(updates.quantity !== undefined && item.portions && !updates.portions
                ? {
                  portions: Array.from({ length: Math.max(1, Math.round(updates.quantity || 1)) }, (_, index) => ({
                    id: item.portions?.[index]?.id ?? generateId(),
                    assignments: item.portions?.[index]?.assignments ?? [],
                  })),
                }
                : {}),
            }
            : item
        ),
      };
    });
  };

  const removeItem = (itemId: string) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        items: prevMeal.items.filter((item) => item.id !== itemId),
      };
    });
  };

  const updateReceiptMeta = (meta: Partial<ReceiptMeta>) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        receiptMeta: { ...prevMeal.receiptMeta, ...meta },
      };
    });
  };

  const addAdjustment = (adjustment: Omit<Adjustment, 'id'>) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      const newAdjustment: Adjustment = {
        ...adjustment,
        id: generateId(),
      };
      return {
        ...prevMeal,
        adjustments: [...prevMeal.adjustments, newAdjustment],
      };
    });
  };

  const removeAdjustment = (adjustmentId: string) => {
    setMeal((prevMeal) => {
      if (!prevMeal) return prevMeal;
      return {
        ...prevMeal,
        adjustments: prevMeal.adjustments.filter((adj) => adj.id !== adjustmentId),
      };
    });
  };

  const resetMeal = () => {
    setMeal(null);
    setSavedDraft(null);
    storageSet(null);
  };

  return (
    <MealContext.Provider
      value={{
        meal,
        savedDraft,
        resumeDraft,
        discardDraft,
        createMeal,
        updateMealInfo,
        addDiner,
        removeDiner,
        updateDiner,
        addItem,
        updateItem,
        removeItem,
        updateReceiptMeta,
        addAdjustment,
        removeAdjustment,
        resetMeal,
      }}
    >
      {children}
    </MealContext.Provider>
  );
}

export function useMeal() {
  const context = useContext(MealContext);
  if (context === undefined) {
    throw new Error('useMeal must be used within a MealProvider');
  }
  return context;
}
