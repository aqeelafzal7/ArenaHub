export type UserRole = 'Organizer' | 'Participant';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  cnic: string;
  role: UserRole;
  createdAt: any; // Firestore Timestamp
}

export interface Hub {
  id: string;
  ownerUid: string;
  hubName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  createdAt: any;
}

export interface Quiz {
  id: string;
  hubId: string;
  title: string;
  timeLimit: number; // in minutes
  passPercentage: number;
  isActive: boolean;
  isLiveCompetition: boolean;
  createdAt: any;
  totalAttemptsAllowed?: number;
  allowedCnics?: string[];
  openAt?: string;
  closeAt?: string;
  postSubmissionText?: string;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  options: string[];
  correctOption: number; // index (0 to 3)
  imageUrl?: string;
}

export interface Attempt {
  id: string;
  hubId: string;
  quizId: string;
  userId: string;
  userName: string;
  userCnic: string;
  userEmail: string;
  score: number;
  timeSpentSeconds: number;
  passed: boolean;
  cheatFlags: string[];
  status: 'In Progress' | 'Submitted' | 'Locked Out';
  cameraStatus?: string;
  studentAnswers?: Record<string, any>;
  ipAddress?: string;
  deviceInfo?: string;
  startedAt?: string;
  submittedAt?: string;
  createdAt: any;
  updatedAt: any;
}

export type ThemeMode = 'light' | 'dark' | 'colorblind';
