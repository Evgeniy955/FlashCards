import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, dictionaryId, progress } = req.body;

  if (!userId || !dictionaryId || !progress) {
    return res.status(400).json({ error: 'Missing required fields: userId, dictionaryId, progress' });
  }

  try {
    const docRef = db.collection('users').doc(userId).collection('progress').doc(dictionaryId);
    await docRef.set(progress, { merge: true });
    res.status(200).json({ message: 'Progress saved successfully' });
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
}
