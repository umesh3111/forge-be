import * as admin from 'firebase-admin';
import { getConfig } from './config.service';

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const projectId = getConfig('FIREBASE_PROJECT_ID');
  const privateKey = getConfig('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const clientEmail = getConfig('FIREBASE_CLIENT_EMAIL');

  if (!projectId || !privateKey || !clientEmail) {
    throw new Error('Missing Firebase configuration');
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    }),
  });

  return firebaseApp;
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
}

export { admin }; 