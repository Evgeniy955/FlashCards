import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, dictionaryId } = req.body;

  if (!userId || !dictionaryId) {
    return res.status(400).json({ error: 'Missing required fields: userId, dictionaryId' });
  }

  try {
    const docRef = db.collection('users').doc(userId).collection('progress').doc(dictionaryId);
    await docRef.delete();
    res.status(200).json({ message: 'Progress reset successfully' });
  } catch (error) {
    console.error('Error resetting progress:', error);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
}
