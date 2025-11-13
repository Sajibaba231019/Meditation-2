
import React, { useState, useEffect, useRef } from 'react';
import { generateSpeech } from '../../services/geminiService';
import { decodeBase64, decodeAudioData } from '../../utils/audioUtils';
import type { Language } from '../../types';
import Loader from '../Loader';

const VoiceLab: React.FC = () => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize AudioContext on user interaction
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
    };
    window.addEventListener('click', initAudioContext, { once: true });
    
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      window.removeEventListener('click', initAudioContext);
    };
  }, [audioUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) {
      setError('Please enter some text to synthesize.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      if (!audioContextRef.current) {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioB64 = await generateSpeech(text, language);
      const pcmData = decodeBase64(audioB64);
      const buffer = await decodeAudioData(pcmData, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start();

      // Create a downloadable blob
      const blob = new Blob([pcmData], { type: 'audio/wav' });
      setAudioUrl(URL.createObjectURL(blob));

    } catch (err) {
      console.error(err);
      setError('Failed to generate speech. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 backdrop-blur-md border border-purple-500/30">
        <h2 className="text-3xl font-bold text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
          Voice Lab
        </h2>
        <p className="text-center text-gray-400 mb-6">Experiment with AI-powered text-to-speech generation.</p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="w-full h-36 p-4 bg-gray-900/70 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition text-lg resize-none"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between mt-4">
             <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-300">Language:</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="english">English</option>
                    <option value="urdu">Urdu</option>
                </select>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? 'Generating...' : 'Speak'}
            </button>
          </div>
        </form>
        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>
      
      <div className="mt-6">
        {isLoading && <Loader message="Synthesizing audio..." />}
        {audioUrl && (
          <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-md border border-purple-500/30">
              <h3 className="text-lg font-semibold mb-2">Generated Audio:</h3>
              <audio controls src={audioUrl} className="w-full"></audio>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceLab;
