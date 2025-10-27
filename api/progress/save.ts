import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authAdmin, db } from '../../lib/firebase-admin';
import type { WordProgress } from '../../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).send('Authentication required.');
    }
    const decodedToken = await authAdmin.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    const { progressKey, progressData } = req.body as { progressKey: string; progressData: WordProgress };

    if (!progressKey || !progressData) {
        return res.status(400).send('Missing progress key or data.');
    }

    await db.collection('userProgress').doc(userId).collection('progress').doc(progressKey).set(progressData);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error saving progress:', error);
     if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Token expired.');
    }
    return res.status(500).send('Internal Server Error');
  }
}
