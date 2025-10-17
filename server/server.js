const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
require('dotenv').config();

// Node 18+ has global fetch; no node-fetch needed.

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STABILITY_API_KEY = process.env.STABILITY_API_KEY;

// Generate scene prompt using OpenAI API
async function generateScenePrompt(paragraph, style, bypassCache = false) {
  const cacheKey = `prompt_${paragraph}_${style}`;
  if (!bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at creating concise visual descriptions for image generation. Convert the given narrative paragraph into a detailed scene description, including setting, characters, mood, and perspective, tailored for the specified art style.',
          },
          {
            role: 'user',
            content: `Paragraph: "${paragraph}"\nArt Style: ${style}\nCreate a visual scene description in 50-100 words.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      let msg = response.statusText;
      try {
        const e = await response.json();
        msg = e.error?.message || msg;
      } catch {}
      throw new Error(`OpenAI API failed: ${msg}`);
    }

    const data = await response.json();
    const scenePrompt = data.choices?.[0]?.message?.content?.trim() || '';
    if (!bypassCache) cache.set(cacheKey, scenePrompt);
    return scenePrompt;
  } catch (error) {
    throw new Error(`Failed to generate scene prompt: ${error.message}`);
  }
}

// Generate image using Stability AI API
async function generateImage(scenePrompt, style) {
  const cacheKey = `image_${scenePrompt}_${style}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${STABILITY_API_KEY}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [{ text: `${scenePrompt}, ${style} style` }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 20,
        }),
      }
    );

    if (!response.ok) {
      let msg = response.statusText;
      try {
        const e = await response.json();
        msg = e.message || msg;
      } catch {}
      throw new Error(`Stability AI API failed: ${msg}`);
    }

    const data = await response.json();
    const imageBase64 = data.artifacts?.[0]?.base64;
    const imageUrl = `data:image/png;base64,${imageBase64}`;
    cache.set(cacheKey, imageUrl);
    return imageUrl;
  } catch (error) {
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

app.get('/api', (_req, res) => res.json({ ok: true }));

app.post('/api/generate-prompt', async (req, res) => {
  const { paragraph, style, bypassCache } = req.body || {};
  if (!paragraph || !style) return res.status(400).json({ error: 'Missing paragraph or style' });

  try {
    const scenePrompt = await generateScenePrompt(paragraph, style, bypassCache);
    res.json({ scenePrompt });
  } catch (error) {
    console.error('Prompt Generation Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-image', async (req, res) => {
  const { scenePrompt, style } = req.body || {};
  if (!scenePrompt || !style) return res.status(400).json({ error: 'Missing scene prompt or style' });

  try {
    const imageUrl = await generateImage(scenePrompt, style);
    res.json({ imageUrl });
  } catch (error) {
    console.error('Image Generation Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
