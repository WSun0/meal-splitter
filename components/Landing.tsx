'use client';

interface LandingProps {
  onSelectMode: (mode: 'upload' | 'manual') => void;
}

export default function Landing({ onSelectMode }: LandingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 overflow-auto relative">
      {/* Soft gradient orbs in background */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary-200/30 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-2xl w-full relative z-10 stagger-children">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-400 to-primary-600 mb-6 shadow-lg shadow-primary-500/25 animate-float">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-stone-800 mb-4 tracking-tight">
            Will's Meal Splitting Tool
          </h1>
          <p className="text-xl text-stone-500 max-w-md mx-auto leading-relaxed">
            Split the bill fairly, without the awkward math
          </p>
        </div>

        {/* Two main options */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {/* Upload Receipt Option */}
          <button
            onClick={() => onSelectMode('upload')}
            className="card-elevated p-6 text-left group"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 mb-5 group-hover:from-primary-400 group-hover:to-primary-600 transition-all duration-300">
              <svg
                className="w-7 h-7 text-primary-600 group-hover:text-white transition-colors duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-stone-800 mb-2">
              Scan Receipt
            </h2>
            <p className="text-stone-500 text-sm mb-4 leading-relaxed">
              Upload a photo and we'll extract items automatically
            </p>
            <div className="flex items-center text-primary-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all duration-300">
              Get started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>

          {/* Manual Entry Option */}
          <button
            onClick={() => onSelectMode('manual')}
            className="card-elevated p-6 text-left group"
          >
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-200 mb-5 group-hover:from-secondary-400 group-hover:to-secondary-600 transition-all duration-300">
              <svg
                className="w-7 h-7 text-secondary-600 group-hover:text-white transition-colors duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-stone-800 mb-2">
              Enter Manually
            </h2>
            <p className="text-stone-500 text-sm mb-4 leading-relaxed">
              Type in items and prices for quick splits
            </p>
            <div className="flex items-center text-secondary-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all duration-300">
              Get started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>
        </div>

        {/* How it works */}
        <div className="card p-6">
          <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-5 text-center">
            How it works
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { num: '1', title: 'Add items', desc: 'Scan or enter' },
              { num: '2', title: 'Assign', desc: 'Who ate what' },
              { num: '3', title: 'Split', desc: 'Fair totals' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3 shadow-md shadow-primary-500/20">
                  {step.num}
                </div>
                <p className="font-semibold text-stone-800 text-sm">{step.title}</p>
                <p className="text-xs text-stone-400 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
