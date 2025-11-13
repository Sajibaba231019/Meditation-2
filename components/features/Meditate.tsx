import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateMeditationScript,
  generateSpeech,
  generateImage,
} from '../../services/geminiService';
import { decodeBase64, decodeAudioData, pcmToWav } from '../../utils/audioUtils';
import { blobToBase64 } from '../../utils/fileUtils';
import { addHistoryItem, getAllHistoryItems, deleteHistoryItem, trimHistory } from '../../utils/db';
import Loader from '../Loader';
import type { Language, MeditationScript, HistoryItem } from '../../types';

const DURATION_OPTIONS = [1, 3, 5];
const ALL_TOPICS = [
    'Overcome creative blocks', 'Cultivate inner peace', 'Letting go of the past', 
    'Embracing change', 'Finding clarity in chaos', 'Building self-confidence',
    'A journey through a mystical forest', 'Walking on a celestial beach',
    'Deep healing sleep', 'Mindfulness of breath', 'Releasing physical tension'
];


const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
};

const CircularTimer = ({ remaining, total }: { remaining: number; total: number }) => {
    const RADIUS = 50;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    
    if (total <= 0) return null;
    
    const progress = Math.max(0, remaining / total);
    const offset = CIRCUMFERENCE * (1 - progress);
  
    return (
      <div className="absolute top-4 right-4 w-28 h-28 drop-shadow-lg">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            strokeWidth="8"
            className="stroke-black/30"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            strokeWidth="8"
            className="stroke-purple-400"
            fill="transparent"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.3s linear' }}
            strokeLinecap="round"
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dy=".3em"
            className="text-2xl font-mono fill-white"
          >
            {formatTime(remaining)}
          </text>
        </svg>
      </div>
    );
};


const Meditate: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [language, setLanguage] = useState<Language>('english');
  const [duration, setDuration] = useState<number>(3);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [session, setSession] = useState<MeditationScript | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [displayedTopics, setDisplayedTopics] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<number | null>(null);

  const shuffleTopics = useCallback(() => {
    const shuffled = [...ALL_TOPICS].sort(() => 0.5 - Math.random());
    setDisplayedTopics(shuffled.slice(0, 5));
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
        try {
            const items = await getAllHistoryItems();
            setHistory(items);
        } catch (e) {
            console.error("Failed to load history from IndexedDB", e);
            if (e === 'IndexedDB not supported') {
                setError("Your browser may not support session history (e.g., in private mode).");
            }
        }
    };
    loadHistory();
    shuffleTopics();
  }, [shuffleTopics]);


  const cleanupPlayback = useCallback(() => {
    if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
    }
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { /* ignore error if already stopped */ }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;

    if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
    }
  }, [audioUrl]);

  useEffect(() => {
    return cleanupPlayback;
  }, [cleanupPlayback]);

  const playAudioFromBlob = async (wavBlob: Blob) => {
    cleanupPlayback();
    
    const url = URL.createObjectURL(wavBlob);
    setAudioUrl(url);

    // Create a local audio context, scoped to this playback attempt.
    const localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Store it in the ref to mark it as the "current" context.
    audioContextRef.current = localAudioContext;
    
    try {
      const arrayBuffer = await wavBlob.arrayBuffer();
      // After an async operation, check if our context is still the current one.
      // If not, it means another playback has started, and this one should be aborted.
      if (audioContextRef.current !== localAudioContext) {
        localAudioContext.close(); // Clean up our local context.
        return;
      }
      const audioBuffer = await localAudioContext.decodeAudioData(arrayBuffer);

      // Check again after the second async operation.
      if (audioContextRef.current !== localAudioContext) {
        localAudioContext.close();
        return;
      }

      const source = localAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(localAudioContext.destination);
      
      // Store the source in the ref so it can be stopped by cleanupPlayback.
      audioSourceRef.current = source;
      
      const sessionTotalDuration = audioBuffer.duration;
      setTotalDuration(sessionTotalDuration);
      setRemainingTime(sessionTotalDuration);

      const audioStartTime = localAudioContext.currentTime;
      
      const updateTimer = () => {
        // The timer should only run if our context is still the active one.
        if (audioContextRef.current !== localAudioContext || localAudioContext.state === 'closed') {
          if (timerRef.current) cancelAnimationFrame(timerRef.current);
          timerRef.current = null;
          return;
        }

        const elapsedTime = localAudioContext.currentTime - audioStartTime;
        const newRemainingTime = Math.max(0, sessionTotalDuration - elapsedTime);
        setRemainingTime(newRemainingTime);

        if (newRemainingTime > 0) {
            timerRef.current = requestAnimationFrame(updateTimer);
        } else {
            setRemainingTime(0);
        }
      };

      source.onended = () => {
          if (timerRef.current) {
           cancelAnimationFrame(timerRef.current);
           timerRef.current = null;
         }
         setRemainingTime(0);
         // Clean up refs if this source is still the "current" one.
         if (audioSourceRef.current === source) {
           audioSourceRef.current = null;
         }
         if (audioContextRef.current === localAudioContext) {
           localAudioContext.close();
           audioContextRef.current = null;
         }
      };

      source.start();
      timerRef.current = requestAnimationFrame(updateTimer);

    } catch (err) {
      console.error("Error playing audio:", err);
      setError("An error occurred while playing the audio. The file might be corrupted.");
      if (localAudioContext.state !== 'closed') {
        localAudioContext.close();
      }
      if (audioContextRef.current === localAudioContext) {
        audioContextRef.current = null;
      }
    }
  };

  const generateSession = async (promptToUse: string) => {
    if (!promptToUse) {
      setError('Please enter a topic for your meditation.');
      return;
    }

    setIsLoading(true);
    setError(null);
    cleanupPlayback();
    setSession(null);
    setImage(null);
    setRemainingTime(null);
    setTotalDuration(null);
    
    try {
      setLoadingMessage('Crafting a unique script...');
      const script = await generateMeditationScript(promptToUse, language, duration);
      setSession(script);

      setLoadingMessage('Visualizing a serene scene...');
      const generatedImage = await generateImage(script.main_visual_prompt);
      const imageDataUrl = `data:image/jpeg;base64,${generatedImage}`;
      setImage(imageDataUrl);

      setLoadingMessage('Synthesizing a calming voice...');
      const tempAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const audioBuffers: AudioBuffer[] = [];
      for (const segment of script.segments) {
          const audioB64 = await generateSpeech(segment.paragraph, language);
          const pcmData = decodeBase64(audioB64);
          const buffer = await decodeAudioData(pcmData, tempAudioContext, 24000, 1);
          audioBuffers.push(buffer);
      }
      await tempAudioContext.close();

      const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const offlineCtx = new OfflineAudioContext(1, totalLength, 24000);
      const combinedBuffer = offlineCtx.createBuffer(1, totalLength, 24000);
      const channelData = combinedBuffer.getChannelData(0);

      let offset = 0;
      for (const buffer of audioBuffers) {
          channelData.set(buffer.getChannelData(0), offset);
          offset += buffer.length;
      }
      
      const wavBlob = pcmToWav(channelData, 1, 24000);

      const audioB64 = await blobToBase64(wavBlob);
      const newHistoryItem: HistoryItem = {
        id: Date.now(),
        script,
        imageUrl: imageDataUrl,
        audioWavBase64: audioB64,
      };
      
      try {
        await addHistoryItem(newHistoryItem);
        await trimHistory(10); // Keep only the 10 newest items
        const updatedHistory = await getAllHistoryItems();
        setHistory(updatedHistory);
      } catch (e) {
        console.error("Failed to save history to IndexedDB", e);
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            setError("Could not save session to history as it's too large for your device's storage. Try a shorter duration.");
        } else {
            setError('Failed to save session history. It will be available until you refresh the page.');
        }
      }

      await playAudioFromBlob(wavBlob);
      
    } catch (err) {
      console.error(err);
      setError('Failed to generate meditation session. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handlePlayFromHistory = (item: HistoryItem) => {
    if (isLoading) return;
    cleanupPlayback();
    setSession(item.script);
    setImage(item.imageUrl);
    const audioBytes = decodeBase64(item.audioWavBase64);
    const wavBlob = new Blob([audioBytes], { type: 'audio/wav' });
    playAudioFromBlob(wavBlob);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFromHistory = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this session from your history?')) {
      try {
        await deleteHistoryItem(id);
        setHistory(prev => prev.filter(item => item.id !== id));
      } catch (e) {
        console.error("Failed to delete history item from IndexedDB", e);
        setError("Could not delete the session from history. Please try again.");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateSession(prompt);
  };

  const handleSurpriseMe = () => {
    const surprisePrompt = 'A surprising and unique guided meditation on a random, uplifting topic suitable for anyone.';
    setPrompt(surprisePrompt);
    generateSession(surprisePrompt);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Zenith AI Meditation: ${session?.title || 'Custom Session'}`,
        text: `Experience a custom guided meditation generated by AI. Prompt: "${prompt}"`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert("Sharing is not supported on your browser.");
    }
  };
  
  const SessionPlayer = () => (
    <div className="mt-8 bg-gray-800/50 rounded-2xl shadow-2xl p-4 sm:p-6 backdrop-blur-md border border-purple-500/30 overflow-hidden">
        <h2 className="text-2xl font-bold text-center mb-4 text-purple-300">{session?.title}</h2>
        <div className="relative aspect-video rounded-lg overflow-hidden shadow-lg mb-4">
            {image ? (
                <img src={image} alt={session?.main_visual_prompt} className="absolute top-0 left-0 w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">Generating visual...</div>
            )}
            {remainingTime !== null && totalDuration !== null && (
                <CircularTimer remaining={remainingTime} total={totalDuration} />
            )}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full"></audio>}
        <div className="flex flex-wrap justify-center gap-4 mt-4">
            {audioUrl && <a href={audioUrl} download={`${session?.title?.replace(/\s/g, '_') || 'meditation'}.wav`} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition"><span className="material-icons mr-2">download</span>Download Audio</a>}
            {image && <a href={image} download={`${session?.title?.replace(/\s/g, '_') || 'visual'}.jpg`} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition"><span className="material-icons mr-2">photo_camera</span>Download Image</a>}
            <button onClick={handleShare} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition"><span className="material-icons mr-2">share</span>Share</button>
        </div>
    </div>
  );

  const HistoryPanel = () => (
    history.length > 0 && (
        <div className="mt-8 bg-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md border border-purple-500/30">
            <h2 className="text-2xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
                Your Past Sessions
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {history.map(item => (
                    <div key={item.id} className="bg-gray-900/70 rounded-lg overflow-hidden group relative shadow-lg">
                        <div className="relative aspect-video">
                            <img src={item.imageUrl} alt={item.script.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button 
                                    onClick={() => handlePlayFromHistory(item)}
                                    className="bg-purple-600/80 hover:bg-purple-500 rounded-full w-16 h-16 flex items-center justify-center text-white transform transition-transform hover:scale-110"
                                    aria-label={`Play meditation: ${item.script.title}`}
                                >
                                    <span className="material-icons text-4xl">play_arrow</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-3">
                            <h3 className="font-semibold truncate text-gray-200">{item.script.title}</h3>
                        </div>
                        <button
                            onClick={() => handleDeleteFromHistory(item.id)}
                            className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 rounded-full w-8 h-8 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 transform hover:scale-110"
                            aria-label={`Delete meditation: ${item.script.title}`}
                            title="Delete session"
                        >
                            <span className="material-icons text-lg">delete</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
  );


  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md border border-purple-500/30">
        <h2 className="text-3xl font-bold text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
          Create Your Meditation
        </h2>
        <p className="text-center text-gray-400 mb-6">Describe the kind of meditation you need, and let AI create a unique session for you.</p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A session to release anxiety, with sounds of a gentle rain"
            className="w-full h-28 p-4 bg-gray-900/70 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition text-lg resize-none"
            disabled={isLoading}
          />
          
          <div className="mt-4 flex flex-wrap justify-center items-center gap-2">
            <p className="w-full sm:w-auto text-center text-sm text-gray-400 mb-1">Need inspiration?</p>
            {displayedTopics.map(topic => (
                <button
                type="button"
                key={topic}
                onClick={() => setPrompt(topic)}
                disabled={isLoading}
                className="px-3 py-1 bg-gray-700/60 border border-gray-600 rounded-full text-sm text-gray-300 hover:bg-purple-600 hover:border-purple-500 transition disabled:opacity-50"
                >
                {topic}
                </button>
            ))}
             <button
                type="button"
                onClick={shuffleTopics}
                disabled={isLoading}
                className="p-1.5 bg-gray-700/60 border border-gray-600 rounded-full text-gray-300 hover:bg-purple-600 hover:border-purple-500 transition disabled:opacity-50"
                aria-label="Refresh topics"
            >
                <span className="material-icons">refresh</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="font-semibold text-gray-300 mb-2 block text-sm">Duration (min):</label>
                  <div className="inline-flex rounded-md shadow-sm" role="group">
                    {DURATION_OPTIONS.map((d, i) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setDuration(d)}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 z-10 disabled:opacity-50
                          ${duration === d ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}
                          ${i === 0 ? 'rounded-l-lg' : ''}
                          ${i === DURATION_OPTIONS.length - 1 ? 'rounded-r-lg' : 'border-r-0'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-gray-300 mb-2 block text-sm">Language:</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} disabled={isLoading} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 h-[42px]">
                      <option value="english">English</option>
                      <option value="urdu">Urdu</option>
                  </select>
                </div>
              </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                <button
                    type="button"
                    onClick={handleSurpriseMe}
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                    <span className="material-icons">auto_awesome</span>
                    Surprise Me
                </button>
                <button
                type="submit"
                disabled={isLoading || !prompt}
                className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                <span className="material-icons">{isLoading ? 'hourglass_top' : 'self_improvement'}</span>
                {isLoading ? 'Generating...' : 'Create Session'}
                </button>
            </div>
          </div>
        </form>
        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>

      {isLoading && (
        <div className="mt-8">
          <Loader message={loadingMessage} />
        </div>
      )}

      {session && !isLoading && <SessionPlayer />}
      {!isLoading && <HistoryPanel />}

    </div>
  );
};

export default Meditate;