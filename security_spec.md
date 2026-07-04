# ArenaHub Security Specification

This document defines the zero-trust security architecture, attribute-based access control (ABAC) invariants, and penetration testing payloads ("Dirty Dozen") for the ArenaHub Multi-Tenant Quiz Platform.

## 1. Data Invariants

*   **User Identity Security**: Users cannot modify their `uid` or escalate their `role` once onboarding is complete.
*   **Tenant Isolation**: A hub can only be created or modified by an authenticated user with the `Organizer` role, and they must be the `ownerUid` of that hub.
*   **Quiz Protection**: Only the owner of a Hub can create, update, or delete quizzes belonging to that Hub.
*   **Anti-Cheat Score Protection**: Participants can create a quiz `Attempt` only for themselves, initializing with `score` = 0, `cheatFlags` = [], and `status` = 'In Progress'.
*   **State Machine Enforcement**: Once an attempt's `status` is updated to a terminal state (`Submitted` or `Locked Out`), no further modifications to score, answers, or flags can be made by the participant.
*   **Data Leak Protection**: Attempts can only be read by the participant who created them or the Hub's Organizer (owner). No participant can see other users' attempts or cheat logs.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads attempt to breach the boundaries of ArenaHub and must be blocked by Firestore Security Rules.

### Payload 1: Role Escalation during Onboarding
*   **Collection**: `/users/{uid}` (by non-admin participant trying to self-promote to `Organizer` after registering)
*   **Payload**: `{ "uid": "victim_uid", "email": "hacker@gmail.com", "name": "Hacker", "cnic": "12345-1234567-1", "role": "Organizer", "createdAt": "request.time" }`
*   **Result**: Permitted ONLY if creating first time. If updating an existing "Participant" user to "Organizer", it must be BLOCKED.

### Payload 2: Hijacking Another Organization's Hub Settings
*   **Collection**: `/hubs/{hubId}` (by user `hacker_uid` trying to edit the title/colors of a hub owned by `victim_uid`)
*   **Payload**: `{ "id": "target_hub_id", "ownerUid": "victim_uid", "hubName": "Hacked Hub Name", "logoUrl": "http://evil.com/logo.png", "primaryColor": "#ff0000", "secondaryColor": "#000000" }`
*   **Result**: `PERMISSION_DENIED` - ownerUid must match `request.auth.uid`.

### Payload 3: Injecting Giant IDs (Denial of Wallet Attack)
*   **Collection**: `/hubs/{very_long_junk_id_10000_chars}`
*   **Result**: `PERMISSION_DENIED` - Document IDs must pass `isValidId` check (length <= 128, valid regex).

### Payload 4: Overwriting Quiz Configuration in another Hub
*   **Collection**: `/quizzes/{quizId}`
*   **Payload**: `{ "id": "quiz_123", "hubId": "victim_hub_id", "title": "Free Marks for Everyone", "timeLimit": 1000, "passPercentage": 0, "isActive": true, "isLiveCompetition": true }`
*   **Result**: `PERMISSION_DENIED` - Hub must be owned by `request.auth.uid`.

### Payload 5: Spoofing User Identity in Attempts (Creating attempt for someone else)
*   **Collection**: `/attempts/{attemptId}`
*   **Payload**: `{ "id": "attempt_99", "hubId": "hub_1", "quizId": "quiz_1", "userId": "victim_uid", "userName": "Victim Name", "userCnic": "12345-1234567-1", "userEmail": "victim@gmail.com", "score": 0, "timeSpentSeconds": 0, "passed": false, "cheatFlags": [], "status": "In Progress" }`
*   **Result**: `PERMISSION_DENIED` - `incoming().userId` must match `request.auth.uid`.

### Payload 6: Pre-setting High Score on Attempt Creation
*   **Collection**: `/attempts/{attemptId}`
*   **Payload**: `{ "id": "attempt_99", "hubId": "hub_1", "quizId": "quiz_1", "userId": "hacker_uid", "userName": "Hacker", "userCnic": "12345-1234567-2", "userEmail": "hacker@gmail.com", "score": 100, "timeSpentSeconds": 1, "passed": true, "cheatFlags": [], "status": "In Progress" }`
*   **Result**: `PERMISSION_DENIED` - Must initialize score to 0 on creation.

### Payload 7: Clearing Proctoring/Cheat Flags after cheating
*   **Collection**: `/attempts/{attemptId}` (Hacker trying to remove "Tab Switched" flag recorded by proctoring engine)
*   **Payload**: `{ "id": "attempt_99", "hubId": "hub_1", "quizId": "quiz_1", "userId": "hacker_uid", "score": 10, "timeSpentSeconds": 50, "passed": false, "cheatFlags": [], "status": "Submitted" }` (where existing `cheatFlags` contained `["Tab Switched"]`)
*   **Result**: `PERMISSION_DENIED` - Users cannot delete elements from `cheatFlags` or bypass the array values.

### Payload 8: Post-Submission State Tampering
*   **Collection**: `/attempts/{attemptId}` (Attempt is already status='Submitted', user tries to increase score)
*   **Payload**: `{ "id": "attempt_99", "score": 95, "status": "Submitted", "updatedAt": "request.time" }`
*   **Result**: `PERMISSION_DENIED` - Terminal states cannot be updated.

### Payload 9: Cross-Tenant Attempt Scraping (Querying other participants' scores)
*   **Collection**: `/attempts` (Request: `allow list: if isSignedIn()`)
*   **Result**: `PERMISSION_DENIED` - Queries must filter by `userId == request.auth.uid` or the user must be the Hub's Organizer.

### Payload 10: Email Spoofing Attack on Profile Setup
*   **Collection**: `/users/{uid}`
*   **Payload**: `{ "uid": "hacker_uid", "email": "victim_admin@gmail.com", "name": "Fake Admin", "cnic": "11111-1111111-1", "role": "Organizer" }`
*   **Result**: `PERMISSION_DENIED` - Profile `email` must match `request.auth.token.email`.

### Payload 11: Modifying Question Content
*   **Collection**: `/questions/{questionId}` (By participant attempting to change options to make everything choice A)
*   **Payload**: `{ "id": "q_1", "quizId": "quiz_1", "text": "What is 1+1?", "options": ["2", "2", "2", "2"], "correctOption": 0 }`
*   **Result**: `PERMISSION_DENIED` - Only the owner of the quiz can write.

### Payload 12: Injecting Unverified or Malformed Timestamps
*   **Collection**: `/attempts/{attemptId}` (Submitting custom client-side `createdAt` timestamp to cheat on time elapsed)
*   **Payload**: `{ "id": "attempt_99", "createdAt": "2020-01-01T00:00:00Z" }`
*   **Result**: `PERMISSION_DENIED` - `createdAt` must strictly equal `request.time`.
