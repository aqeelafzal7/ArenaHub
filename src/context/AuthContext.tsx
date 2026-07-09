import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, ThemeMode } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  onboardUser: (role: UserRole, cnic: string, name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isQuizStarted: boolean;
  setIsQuizStarted: (isStarted: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light';
  });

  // Apply Theme class to document root
  const setTheme = (newTheme: ThemeMode) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'colorblind');
    root.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  useEffect(() => {
    // Initial theme mounting
    setTheme(theme);
  }, [theme]);

  const fetchProfile = async (currentUser: User) => {
    const path = `users/${currentUser.uid}`;
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Auth Error:', err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (err) {
      console.error('Email Registration Error:', err);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error('Email Sign In Error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Logout Error:', err);
      throw err;
    }
  };

  const onboardUser = async (role: UserRole, cnic: string, name: string) => {
    if (!user) throw new Error('No authenticated user found for onboarding.');
    const path = `users/${user.uid}`;
    
    // Structure User profile
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      name: name.trim() || user.displayName || 'No Name',
      cnic,
      role,
      createdAt: new Date().toISOString() // String formatted or timestamp
    };

    try {
      const userDocRef = doc(db, 'users', user.uid);
      // Save directly to firestore
      await setDoc(userDocRef, {
        ...newProfile,
        createdAt: serverTimestamp() // Set server timestamp as per rules requirement
      });
      setProfile(newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      theme,
      setTheme,
      signInWithGoogle,
      signUpWithEmail,
      loginWithEmail,
      logout,
      onboardUser,
      refreshProfile,
      isQuizStarted,
      setIsQuizStarted
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
