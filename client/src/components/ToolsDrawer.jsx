import { useState } from 'react';
import { generatePrompt, generateImage } from '../lib/api';

export default function ToolsDrawer({
  isOpen, onClose, paragraph, setParagraph,
  onImageCreated, onPromptSaved
}) {
  const [style, setStyle] = useState('watercolor');
  const [scenePrompt, setScenePrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  const mkPrompt = async () => {
    try {
      setErr(''); setLoading(true);
      const { scenePrompt } = await generatePrompt(paragraph, style);
      setScenePrompt(scenePrompt);
      setEditedPrompt(scenePrompt);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const regen = async () => {
    try {
      setErr(''); setLoading(true);
      const { scenePrompt } = await generatePrompt(paragraph, style, true);
      setScenePrompt(scenePrompt);
      setEditedPrompt(scenePrompt);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const mkImage = async () => {
    try {
      setErr(''); setLoading(true);
      const promptToUse = editedPrompt || scenePrompt;
      const { imageUrl } = await generateImage(promptToUse, style);
      setImageUrl(imageUrl);
      onImageCreated?.({ url: imageUrl, style, prompt: promptToUse });
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const savePrompt = () => {
    const promptToUse = editedPrompt || scenePrompt;
    if (!promptToUse) return;
    onPromptSaved?.({ prompt: promptToUse, style, source: paragraph || '' });
  };

  return (
    <aside className="tools-drawer retro-box" onClick={(e)=>e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Scene Generator</h3>
        <button className="retro-box px-2 py-1" onClick={onClose}>
          <i className="fas fa-xmark" />
        </button>
      </div>

      <p className="text-sm opacity-70">
        Highlight text in the book (or paste below), then make a prompt.
      </p>

      {/* 1. Paragraph */}
      <label className="text-xs font-semibold mt-2">Paragraph</label>
      <textarea
        className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none"
        rows="5"
        placeholder="Selected paragraph…"
        value={paragraph}
        onChange={(e)=>setParagraph(e.target.value)}
      />

      {/* 2. Art Style + Make Prompt (ONE ROW) */}
      <div className="sg-controls mt-3">
        <label className="text-sm">Art style</label>
        <select
          className="p-2 border border-gray-200 rounded-lg bg-white text-gray-800"
          value={style}
          onChange={(e)=>setStyle(e.target.value)}
        >
          <option value="watercolor">Watercolor</option>
          <option value="noir">Noir</option>
          <option value="pixel-art">Pixel Art</option>
          <option value="oil-painting">Oil Painting</option>
          <option value="sketch">Sketch</option>
        </select>

        <button
          className="sg-btn retro-box px-3 py-2"
          disabled={!paragraph || loading}
          onClick={mkPrompt}
        >
          <i className="fas fa-wand-magic-sparkles mr-1" />
          {loading ? 'Working…' : 'Make Prompt'}
        </button>
      </div>

      {/* 3. Review Scene Prompt */}
      <label className="text-xs font-semibold mt-4">Review Scene Prompt</label>
      <textarea
        className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none"
        rows="5"
        value={editedPrompt}
        onChange={(e)=>setEditedPrompt(e.target.value)}
        placeholder={scenePrompt ? '' : 'Your generated prompt will appear here…'}
      />

      {/* 4. Generate Image + Regenerate (ONE ROW) */}
      <div className="sg-gen-row mt-3">
        <button
          className="sg-btn retro-box px-3 py-2"
          disabled={loading || !(editedPrompt || scenePrompt)}
          onClick={mkImage}
        >
          <i className="fas fa-image mr-1" />
          Generate Image
        </button>

        <button
          className="sg-btn retro-box px-3 py-2"
          disabled={!paragraph || loading}
          onClick={regen}
        >
          <i className="fas fa-arrows-rotate mr-1" />
          Regenerate
        </button>
      </div>

      {/* 5. Save Prompt (CENTERED UNDER THE TWO BUTTONS) */}
      <div className="sg-save-row mt-2">
        <button
          className="sg-btn retro-box px-3 py-2"
          disabled={!(editedPrompt || scenePrompt)}
          onClick={savePrompt}
        >
          <i className="fas fa-bookmark mr-1" />
          Save Prompt
        </button>
      </div>

      {imageUrl && (
        <div className="mt-4">
          <div className="font-semibold mb-1">Generated Image</div>
          <img src={imageUrl} alt="Generated" className="w-full rounded-lg" />
        </div>
      )}

      {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
    </aside>
  );
}
