
import React, { useState, useCallback } from 'react';
import { editImage } from '../../services/geminiService';
import { blobToBase64 } from '../../utils/fileUtils';
import Loader from '../Loader';

const ImageStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [originalImage, setOriginalImage] = useState<{file: File, url: string} | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if(file.size > 4 * 1024 * 1024) {
        setError("File size cannot exceed 4MB.");
        return;
      }
      setOriginalImage({ file, url: URL.createObjectURL(file) });
      setEditedImage(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || !originalImage) {
      setError('Please upload an image and provide an edit instruction.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const base64Data = await blobToBase64(originalImage.file);
      const imageData = {
        data: base64Data,
        mimeType: originalImage.file.type,
      };
      const resultData = await editImage(prompt, imageData);
      setEditedImage(`data:image/png;base64,${resultData}`);
    } catch (err) {
      console.error(err);
      setError('Failed to edit image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 backdrop-blur-md border border-purple-500/30">
        <h2 className="text-3xl font-bold text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-400">
          Image Studio
        </h2>
        <p className="text-center text-gray-400 mb-6">Remix your reality. Upload an image and describe your desired changes.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-600 rounded-lg h-64 bg-gray-900/50">
            <input type="file" id="imageUpload" accept="image/*" onChange={handleFileChange} className="hidden" />
            <label htmlFor="imageUpload" className="cursor-pointer text-center">
              <span className="material-icons text-5xl text-gray-500">upload_file</span>
              <p className="mt-2 text-gray-400">
                {originalImage ? `Selected: ${originalImage.file.name}` : "Click to upload an image"}
              </p>
               <p className="text-xs text-gray-500">Max 4MB</p>
            </label>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Add a retro filter, or remove the person in the background"
              className="w-full flex-grow p-3 bg-gray-900/70 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition text-lg resize-none"
              disabled={isLoading || !originalImage}
            />
            <button
              type="submit"
              disabled={isLoading || !originalImage || !prompt}
              className="mt-4 bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? 'Applying Magic...' : 'Transform'}
            </button>
          </form>
        </div>
        {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
      </div>

      <div className="mt-6">
        {isLoading && <Loader message="Editing your image..." />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {originalImage && (
            <div className="bg-gray-800/50 p-4 rounded-2xl">
              <h3 className="font-semibold mb-2 text-center text-gray-300">Original</h3>
              <img src={originalImage.url} alt="Original" className="rounded-lg w-full h-auto" />
            </div>
          )}
          {editedImage && (
            <div className="bg-gray-800/50 p-4 rounded-2xl">
              <h3 className="font-semibold mb-2 text-center text-gray-300">Edited</h3>
              <img src={editedImage} alt="Edited" className="rounded-lg w-full h-auto" />
              <a href={editedImage} download="ai-edited-image.png" className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition w-full justify-center">
                <span className="material-icons mr-2">download</span>Download Edited Image
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageStudio;
