
import React, { useState } from 'react';
import { generateImage } from '../../services/geminiService';
import Loader from '../Loader';

const Visualizer: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) {
      setError('Please enter a prompt to generate an image.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setImage(null);
    try {
      const imageData = await generateImage(prompt);
      setImage(`data:image/jpeg;base64,${imageData}`);
    } catch (err) {
      console.error(err);
      setError('Failed to generate image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 backdrop-blur-md border border-purple-500/30">
        <h2 className="text-3xl font-bold text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
          AI Visualizer
        </h2>
        <p className="text-center text-gray-400 mb-6">Bring your imagination to life. Describe anything you want to see.</p>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A tranquil zen garden on a distant planet"
              className="flex-grow p-3 bg-gray-900/70 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition text-lg"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>

      <div className="mt-6">
        {isLoading && <Loader message="Creating your vision..." />}
        {image && (
          <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-4 backdrop-blur-md border border-purple-500/30">
            <img src={image} alt={prompt} className="rounded-lg w-full h-auto" />
             <a href={image} download="ai-generated-image.jpg" className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition w-full justify-center">
                <span className="material-icons mr-2">download</span>Download Image
             </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Visualizer;
