import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, dictionaryId } = req.query;

  if (!userId || typeof userId !== 'string' || !dictionaryId || typeof dictionaryId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid query parameters: userId, dictionaryId' });
  }

  try {
    const docRef = db.collection('users').doc(userId).collection('progress').doc(dictionaryId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      res.status(200).json(docSnap.data());
    } else {
      res.status(404).json({ message: 'No progress found' });
    }
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
}
