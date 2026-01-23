'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-primary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-stone-800 mb-3">
          You&apos;re offline
        </h1>

        <p className="text-stone-600 mb-8">
          It looks like you&apos;ve lost your internet connection. Don&apos;t worry - any
          meal data you&apos;ve entered is saved locally on your device.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-soft"
          >
            Try Again
          </button>

          <p className="text-sm text-stone-500">
            Check your connection and try again
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-stone-200">
          <p className="text-sm text-stone-500">
            Tip: You can still view and edit meals you&apos;ve already started.
            Receipt scanning requires an internet connection.
          </p>
        </div>
      </div>
    </main>
  );
}
