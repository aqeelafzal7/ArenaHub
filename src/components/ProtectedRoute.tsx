import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setLocalProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
      setIsChecking(false);
    };

    if (!loading) {
      if (user) {
        fetchUser();
      } else {
        setIsChecking(false);
      }
    }
  }, [user, loading]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
          <ShieldAlert className="h-6 w-6 text-brand-primary absolute" />
        </div>
        <p className="text-sm font-extrabold text-brand-text mt-4 animate-pulse">
          Verifying Access...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If we fetched the profile but the role is not allowed
  if (localProfile && !allowedRoles.includes(localProfile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
