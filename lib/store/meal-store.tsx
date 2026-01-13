'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Meal, Diner, Item, Adjustment, ReceiptMeta } from '../types/meal';
import { generateId, safeJsonParse } from '../utils/helpers';

interface MealContextType {
  meal: Meal | null;
  createMeal: (title: string, restaurant?: string, date?: string) => void;
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

export function MealProvider({ children }: { children: ReactNode }) {
  const [meal, setMeal] = useState<Meal | null>(null);

  // Load meal from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMeal(safeJsonParse<Meal | null>(saved, null));
      }
    }
  }, []);

  // Save meal to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && meal) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meal));
    }
  }, [meal]);

  const createMeal = (title: string, restaurant?: string, date?: string) => {
    const now = new Date().toISOString();
    const newMeal: Meal = {
      id: generateId(),
      title,
      restaurant,
      date: date || now.split('T')[0],
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
      }));
      return {
        ...prevMeal,
        diners: prevMeal.diners.filter((d) => d.id !== dinerId),
        items: updatedItems,
        adjustments: prevMeal.adjustments.filter((adj) => adj.personId !== dinerId),
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
          item.id === itemId ? { ...item, ...updates } : item
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <MealContext.Provider
      value={{
        meal,
        createMeal,
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
