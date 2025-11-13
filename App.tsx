
import React from 'react';
import Meditate from './components/features/Meditate';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900/40 to-gray-900 text-gray-200 flex flex-col items-center">
      <header className="w-full p-4 text-center sticky top-0 z-10">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
          Zenith AI
        </h1>
        <p className="text-sm text-gray-400">Your Personal AI-Powered Meditation Sanctuary</p>
      </header>
      
      <main className="flex-grow w-full p-4 sm:p-6 lg:p-8 flex justify-center">
        <Meditate />
      </main>
    </div>
  );
};

export default App;
