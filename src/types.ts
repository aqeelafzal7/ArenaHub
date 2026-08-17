export type UserRole = 'super_admin' | 'admin' | 'participant' | 'Organizer' | 'Participant';

export interface UserPermissions {
  maxParticipants?: number;
  maxQuestions?: number;
  maxDurationMinutes?: number;
  maxRooms?: number;
  canUsePictureQuestions?: boolean;
  canUseVideoProctoring?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  cnic: string;
  role: UserRole;
  permissions?: string[] | UserPermissions | any;
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
  questions?: Question[];
}

export interface Quiz {
  id: string;
  hubId: string;
  title: string;
  joinCode?: string;
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
  perQuestionTimer?: boolean;
  timePerQuestionSeconds?: number;
}

export interface Question {
  id: string;
  quizId: string;
  text: string;
  options: string[];
  correctOption: number; // index (0 to 3)
  imageUrl?: string;
  originalOptions?: string[];
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
  hardware_bypass?: boolean;
  studentAnswers?: Record<string, any>;
  ipAddress?: string;
  deviceInfo?: string;
  startedAt?: string;
  submittedAt?: string;
  recordingUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export type ThemeMode = 'light' | 'dark' | 'colorblind';
