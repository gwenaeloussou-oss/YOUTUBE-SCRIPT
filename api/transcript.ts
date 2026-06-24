import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractVideoId, fetchYouTubeTranscript } from '../lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const { url } = req.query as { url: string };
  const videoId = extractVideoId(url);
  if (!videoId) { res.status(400).json({ error: 'URL YouTube invalide' }); return; }
  try {
    const transcript = await fetchYouTubeTranscript(videoId);
    res.json({ transcript, videoId });
  } catch {
    res.status(404).json({ error: 'Transcription non disponible pour cette vidéo.' });
  }
}
