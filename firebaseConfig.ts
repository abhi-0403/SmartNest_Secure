import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import type { FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "YOUR FIREBASE API KEY",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Prevent re-initialization in development (Fast Refresh safe)
const app: FirebaseApp =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

export const database = getDatabase(app);
export default app;
