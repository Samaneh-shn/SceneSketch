import { useState } from 'react';
import { generatePrompt, generateImage } from '../lib/api';

export default function SceneGenerator({
  paragraph,
  setParagraph,
  bookTitle,      // ✅ new
  pageNumber,     // ✅ new
}) {
  const [style, setStyle] = useState('watercolor');
  const [scenePrompt, setScenePrompt] = useState('');
  const [editedPrompt, setEditedPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showModal, setShowModal] = useState(false);

  const mkPrompt = async () => {
    try {
      setErr('');
      setLoading(true);
      const { scenePrompt } = await generatePrompt(paragraph, style);
      setScenePrompt(scenePrompt);
      setEditedPrompt(scenePrompt);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const regen = async () => {
    try {
      setErr('');
      setLoading(true);
      const { scenePrompt } = await generatePrompt(paragraph, style, true);
      setScenePrompt(scenePrompt);
      setEditedPrompt(scenePrompt);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const mkImage = async () => {
    try {
      setErr('');
      setLoading(true);
      const { imageUrl } = await generateImage(editedPrompt, style);
      setImageUrl(imageUrl);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ helper to build a smart, safe filename
  const buildDownloadName = () => {
    const dropExt = (name = '') => name.replace(/\.[^/.]+$/, '');
    const slug = (s = '') =>
      dropExt(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'scenesketch';

    const title = slug(bookTitle);
    const page = pageNumber ? String(pageNumber).padStart(4, '0') : 'page';
    const styleSlug = slug(style);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    return `${title}_${page}_${styleSlug}_${y}${m}${d}-${hh}${mm}.png`;
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = buildDownloadName(); // ✅ smart name
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <p className="text-sm opacity-70 mb-2">
        Highlight text in the book (or paste below), then make a prompt.
      </p>

      <label className="text-xs font-semibold">Paragraph</label>
      <textarea
        className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none"
        rows="5"
        placeholder="Selected paragraph…"
        value={paragraph}
        onChange={(e) => setParagraph(e.target.value)}
      />

      <div className="flex items-center gap-2 mt-2">
        <label className="text-sm">Art style</label>
        <select
          className="p-2 border border-gray-200 rounded-lg bg-white text-gray-800"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="watercolor">Watercolor</option>
          <option value="noir">Noir</option>
          <option value="pixel-art">Pixel Art</option>
          <option value="oil-painting">Oil Painting</option>
          <option value="sketch">Sketch</option>
        </select>
        <button
          className="retro-box px-3 py-2"
          disabled={!paragraph || loading}
          onClick={mkPrompt}
        >
          <i className="fas fa-wand-magic-sparkles mr-1"></i>
          {loading ? 'Working…' : 'Make Prompt'}
        </button>
      </div>

      {scenePrompt && (
        <div className="mt-3">
          <label className="text-xs font-semibold">Review Scene Prompt</label>
          <textarea
            className="w-full p-3 border border-gray-200 rounded-lg bg-white text-gray-800 resize-none"
            rows="5"
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              className="retro-box px-3 py-2"
              disabled={!paragraph || loading}
              onClick={regen}
            >
              <i className="fas fa-arrows-rotate mr-1"></i>Regenerate
            </button>
            <button
              className="retro-box px-3 py-2"
              disabled={!editedPrompt || loading}
              onClick={mkImage}
            >
              <i className="fas fa-image mr-1"></i>Generate Image
            </button>
          </div>
        </div>
      )}

      {imageUrl && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Generated Image</div>
          <div className="relative group">
            {/* Clickable preview */}
            <img
              src={imageUrl}
              alt="Generated"
              className="w-full rounded-lg border border-gray-200 cursor-pointer"
              onClick={() => setShowModal(true)}
            />
            {/* Download button on hover */}
            <button
              onClick={handleDownload}
              className="absolute bottom-2 right-2 bg-white/90 retro-box px-3 py-1 text-sm opacity-0 group-hover:opacity-100 transition"
            >
              <i className="fas fa-download mr-1"></i>Save
            </button>
          </div>
        </div>
      )}

      {/* Modal for full-size preview */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div className="max-w-4xl max-h-[90vh] p-2 bg-white rounded-lg" onClick={(e)=>e.stopPropagation()}>
            <img src={imageUrl} alt="Full preview" className="max-h-[80vh] w-auto mx-auto rounded-lg"/>
            <div className="flex justify-end mt-2 gap-2">
              <button className="retro-box px-3 py-1" onClick={handleDownload}>
                <i className="fas fa-download mr-1"></i>Download
              </button>
              <button className="retro-box px-3 py-1" onClick={() => setShowModal(false)}>
                <i className="fas fa-xmark mr-1"></i>Close
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
    </div>
  );
}
