'use client';

import { useState } from 'react';
import { MealProvider, useMeal } from '@/lib/store/meal-store';
import Landing, { Wordmark } from '@/components/Landing';
import DinersManagement from '@/components/meal/DinersManagement';
import ItemsReview from '@/components/receipt/ItemsReview';
import ItemAssignment from '@/components/assignment/ItemAssignment';
import ExtrasManager from '@/components/summary/ExtrasManager';
import MealSummary from '@/components/summary/MealSummary';
import ExportShare from '@/components/summary/ExportShare';
import { todayLocalISODate } from '@/lib/utils/helpers';

type Step = 'items' | 'diners' | 'assign' | 'extras' | 'summary';

const steps: { id: Step; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'diners', label: 'People' },
  { id: 'assign', label: 'Assign' },
  { id: 'extras', label: 'Tax & tip' },
  { id: 'summary', label: 'Bill' },
];

function MealSplitApp() {
  const { meal, resetMeal, createMeal, savedDraft, resumeDraft, discardDraft } = useMeal();
  const [currentStep, setCurrentStep] = useState<Step>('items');

  const handleStart = () => {
    createMeal('New Meal', undefined, todayLocalISODate());
    setCurrentStep('items');
  };

  const handleResume = () => {
    const draft = savedDraft?.meal;
    const assigned = draft?.items.some((item) =>
      item.portions?.length ? item.portions.some((p) => p.assignments.length > 0) : item.assignments.length > 0
    );
    resumeDraft();
    setCurrentStep(!draft?.items.length ? 'items' : !draft.diners.length ? 'diners' : assigned ? 'summary' : 'assign');
  };

  const canProceedFromDiners = meal && meal.diners.length > 0;
  const canProceedFromItems = meal && meal.items.length > 0;
  const hasAssignments = meal?.items.some((item) => {
    if (item.portions && item.portions.length > 0) {
      return item.portions.some((portion) => portion.assignments.length > 0);
    }
    return item.assignments.length > 0;
  });

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen">
      {/* Header + steps, on the folder */}
      {meal && (
        <header className="sticky top-0 z-50 bg-folder/95 backdrop-blur border-b border-folder-line">
          <div className="max-w-2xl mx-auto px-4 pt-3 flex justify-between items-center">
            <Wordmark className="text-lg" />
            <button
              onClick={() => {
                if (confirm('Start a new meal? Current data will be lost.')) {
                  resetMeal();
                }
              }}
              className="btn-folder"
            >
              New split
            </button>
          </div>
          <nav className="max-w-2xl mx-auto px-4" aria-label="Steps">
            <ol className="flex gap-4 sm:gap-6 overflow-x-auto -mb-px">
              {steps.map((step, idx) => {
                const isActive = currentStep === step.id;
                const isPast = idx < currentStepIndex;
                return (
                  <li key={step.id} className="shrink-0">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`flex items-center gap-1.5 py-3 border-b-2 text-[15px] transition-colors ${
                        isActive
                          ? 'border-secondary-400 text-folder-text font-semibold'
                          : isPast
                          ? 'border-transparent text-folder-text/85 hover:text-folder-text'
                          : 'border-transparent text-folder-muted/80 hover:text-folder-text'
                      }`}
                    >
                      <span className={`text-xs tabular-nums ${isActive ? 'text-secondary-400' : ''}`}>
                        {isPast ? '✓' : idx + 1}
                      </span>
                      {step.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </header>
      )}

      {/* Main content */}
      {!meal ? (
        <Landing onStart={handleStart} draft={savedDraft} onResume={handleResume} onDiscard={discardDraft} />
      ) : (
        <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          <div className="space-y-5">
            {currentStep === 'items' && (
              <>
                <ItemsReview />
                {canProceedFromItems && (
                  <div className="flex sm:justify-end">
                    {canProceedFromDiners ? (
                      <button onClick={() => setCurrentStep('assign')} className="btn-cta w-full sm:w-auto text-base py-3.5 px-8">
                        Next: who had what
                      </button>
                    ) : (
                      <button onClick={() => setCurrentStep('diners')} className="btn-cta w-full sm:w-auto text-base py-3.5 px-8">
                        Next: who's splitting
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
                  <div className="flex sm:justify-end">
                    <button onClick={() => setCurrentStep('assign')} className="btn-cta w-full sm:w-auto text-base py-3.5 px-8">
                      Next: who had what
                    </button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'assign' && (
              <>
                <ItemAssignment />
                {hasAssignments && (
                  <div className="flex sm:justify-end">
                    <button onClick={() => setCurrentStep('extras')} className="btn-cta w-full sm:w-auto text-base py-3.5 px-8">
                      Next: tax & tip
                    </button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'extras' && (
              <>
                <ExtrasManager />
                <div className="flex sm:justify-end">
                  <button onClick={() => setCurrentStep('summary')} className="btn-cta w-full sm:w-auto text-base py-3.5 px-8">
                    See the bill
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
        <footer className="mt-10 py-8">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-sm text-folder-muted">
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
