
import React from 'react';

interface LoaderProps {
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-800/50 rounded-lg">
      <div className="w-12 h-12 border-4 border-t-purple-400 border-gray-600 rounded-full animate-spin"></div>
      {message && <p className="mt-4 text-lg font-medium text-gray-300">{message}</p>}
    </div>
  );
};

export default Loader;
