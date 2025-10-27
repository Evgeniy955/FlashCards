import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authAdmin, db } from '../../lib/firebase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).send('Authentication required.');
    }
    const decodedToken = await authAdmin.verifyIdToken(token);
    const userId = decodedToken.uid;

    const snapshot = await db.collection('userProgress').doc(userId).collection('progress').get();
    
    if (snapshot.empty) {
      return res.status(200).json({});
    }

    const progressData: { [key: string]: any } = {};
    snapshot.forEach(doc => {
      progressData[doc.id] = doc.data();
    });

    return res.status(200).json(progressData);

  } catch (error) {
    console.error('Error fetching progress:', error);
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Token expired.');
    }
    return res.status(500).send('Internal Server Error');
  }
}
