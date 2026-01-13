'use client';

import { useState } from 'react';
import { MealProvider, useMeal } from '@/lib/store/meal-store';
import Landing from '@/components/Landing';
import DinersManagement from '@/components/meal/DinersManagement';
import ReceiptUpload from '@/components/receipt/ReceiptUpload';
import ManualEntry from '@/components/receipt/ManualEntry';
import ItemsReview from '@/components/receipt/ItemsReview';
import ItemAssignment from '@/components/assignment/ItemAssignment';
import AdjustmentsManager from '@/components/summary/AdjustmentsManager';
import MealSummary from '@/components/summary/MealSummary';
import ExportShare from '@/components/summary/ExportShare';
import { OCRResult } from '@/lib/types/meal';

type Step = 'diners' | 'receipt' | 'items' | 'assign' | 'adjustments' | 'summary';

const steps: { id: Step; label: string }[] = [
  { id: 'receipt', label: 'Receipt' },
  { id: 'items', label: 'Items' },
  { id: 'diners', label: 'Diners' },
  { id: 'assign', label: 'Assign' },
  { id: 'adjustments', label: 'Adjust' },
  { id: 'summary', label: 'Summary' },
];

function MealSplitApp() {
  const { meal, resetMeal, createMeal, addItem, updateReceiptMeta } = useMeal();
  const [currentStep, setCurrentStep] = useState<Step>('receipt');
  const [receiptMode, setReceiptMode] = useState<'upload' | 'manual'>('upload');

  const handleModeSelection = (mode: 'upload' | 'manual') => {
    createMeal('New Meal', undefined, new Date().toISOString().split('T')[0]);
    setReceiptMode(mode);
    setCurrentStep('receipt');
  };

  const handleOCRSuccess = (result: OCRResult) => {
    result.items.forEach((item) => {
      addItem({ ...item, assignments: [] });
    });

    updateReceiptMeta({
      subtotal: result.receiptMeta.subtotal || 0,
      tax: result.receiptMeta.tax || 0,
      tip: result.receiptMeta.tip || 0,
      fees: result.receiptMeta.fees || [],
      discounts: result.receiptMeta.discounts || [],
      total: result.receiptMeta.total || 0,
    });

    setCurrentStep('items');
  };

  const canProceedFromDiners = meal && meal.diners.length > 0;
  const canProceedFromItems = meal && meal.items.length > 0;
  const hasAssignments = meal?.items.some((item) => item.assignments.length > 0);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen">
      {/* Header */}
      {meal && (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-stone-200/50">
          <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md shadow-primary-500/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-stone-800">
                Will's Meal Splitting Tool
              </h1>
            </div>
            <button
              onClick={() => {
                if (confirm('Start a new meal? Current data will be lost.')) {
                  resetMeal();
                }
              }}
              className="btn-ghost text-sm py-2 px-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>
        </header>
      )}

      {/* Progress indicator */}
      {meal && (
        <div className="sticky top-[57px] z-40 backdrop-blur-xl bg-white/70 border-b border-stone-200/50">
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center py-3 overflow-x-auto">
              {steps.map((step, idx) => {
                const isActive = currentStep === step.id;
                const isPast = idx < currentStepIndex;
                
                return (
                  <div key={step.id} className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={`relative flex items-center gap-1.5 pl-3 pr-4 py-2 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold shadow-md shadow-primary-500/20'
                          : isPast
                          ? 'bg-primary-100 text-primary-700 font-medium hover:bg-primary-150'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                      style={{
                        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
                        marginLeft: idx === 0 ? 0 : '-8px',
                        paddingLeft: idx === 0 ? '12px' : '20px',
                      }}
                    >
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                        isActive ? 'bg-white/25 text-white' : isPast ? 'bg-primary-200 text-primary-700' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {isPast ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span className="text-sm whitespace-nowrap">{step.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {!meal ? (
        <Landing onSelectMode={handleModeSelection} />
      ) : (
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="space-y-6 animate-fade-in">
            {currentStep === 'receipt' && (
              <>
                <div className="card p-1.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setReceiptMode('upload')}
                      className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                        receiptMode === 'upload'
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                          : 'text-stone-500 hover:bg-stone-100'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Photo
                      </span>
                    </button>
                    <button
                      onClick={() => setReceiptMode('manual')}
                      className={`flex-1 py-3 px-4 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                        receiptMode === 'manual'
                          ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md'
                          : 'text-stone-500 hover:bg-stone-100'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Manual Entry
                      </span>
                    </button>
                  </div>
                </div>

                {receiptMode === 'upload' ? (
                  <ReceiptUpload onParseSuccess={handleOCRSuccess} />
                ) : (
                  <ManualEntry />
                )}

                {canProceedFromItems && (
                  <div className="text-center space-y-3">
                    <button onClick={() => setCurrentStep('items')} className="btn-primary text-base py-3 px-8">
                      Continue to Items Review
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'items' && (
              <>
                <ItemsReview />
                {receiptMode === 'manual' && <ManualEntry />}
                {canProceedFromItems && (
                  <div className="text-center">
                    {canProceedFromDiners ? (
                      <button onClick={() => setCurrentStep('assign')} className="btn-primary text-base py-3 px-8">
                        Continue to Assignment
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    ) : (
                      <button onClick={() => setCurrentStep('diners')} className="btn-secondary text-base py-3 px-8">
                        Add Diners First
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {currentStep === 'diners' && (
              <>
                <DinersManagement />
                {canProceedFromDiners && canProceedFromItems && (
                  <div className="text-center">
                    <button onClick={() => setCurrentStep('assign')} className="btn-primary text-base py-3 px-8">
                      Continue to Assignment
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'assign' && (
              <>
                <ItemAssignment />
                {hasAssignments && (
                  <div className="text-center">
                    <button onClick={() => setCurrentStep('adjustments')} className="btn-primary text-base py-3 px-8">
                      Continue to Adjustments
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'adjustments' && (
              <>
                <AdjustmentsManager />
                <div className="text-center">
                  <button onClick={() => setCurrentStep('summary')} className="btn-secondary text-base py-3 px-8">
                    View Final Summary
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {currentStep === 'summary' && (
              <>
                <MealSummary />
                <ExportShare />
              </>
            )}
          </div>
        </main>
      )}

      {/* Footer */}
      {meal && (
        <footer className="mt-12 py-8">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <p className="text-sm text-stone-400">
              © William Sun 2026
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <MealProvider>
      <MealSplitApp />
    </MealProvider>
  );
}
