import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authAdmin, db } from '../../lib/firebase-admin';
import admin from 'firebase-admin';

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
    
    const { dictionaryName } = req.body;
    if (!dictionaryName) {
        return res.status(400).send('Missing dictionary name.');
    }
    
    // In Firestore, we can't delete by prefix, so we query and then delete.
    const progressRef = db.collection('userProgress').doc(userId).collection('progress');
    const query = progressRef.where('dictionaryName', '==', dictionaryName);
    const snapshot = await query.get();

    if (snapshot.empty) {
        return res.status(200).json({ success: true, message: 'No progress to delete.' });
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error resetting progress:', error);
    if (error.code === 'auth/id-token-expired') {
        return res.status(401).send('Token expired.');
    }
    return res.status(500).send('Internal Server Error');
  }
}
