import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import type { FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey:            "AIzaSyA-C2FQkioCrUv6s6RY0srnuhsitg43R-g",
  authDomain:        "smartnest-13e23.firebaseapp.com",
  databaseURL:       "https://smartnest-13e23-default-rtdb.firebaseio.com/",
  projectId:         "smartnest-13e23",
  storageBucket:     "smartnest-13e23.appspot.com",
  messagingSenderId: "",
  appId:             "",
};

// Prevent re-initialization in development (Fast Refresh safe)
const app: FirebaseApp =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

export const database = getDatabase(app);
export default app;