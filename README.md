<div align="center">
  
  # 🛡️ ArenaHub
  **SaaS Multi-Tenant Secure Quiz & Evaluation Platform**

  A highly secure, proctored academic assessment portal designed to maintain the highest standards of academic integrity. Features AI-driven proctoring, multi-tenant organization hubs, and military-grade progressive web app (PWA) lockdown capabilities.

</div>

---

## ✨ Core Features

*   **Enterprise Proctoring & Kiosk Mode:** Participants are restricted from using standard web browsers. The platform enforces a mandatory PWA installation and requires full-screen standalone mode. Background tracking and tripwires instantly detect app-switching or minimization.
*   **Live AI Monitoring:** Continuous behavioral monitoring tracks window focus, audio anomalies, and webcam snapshots, logging all infractions instantly to a real-time database.
*   **Multi-Tenant Architecture:** Organizers can generate custom "Hub IDs," allowing different universities, societies, or classes to take branded, isolated exams simultaneously.
*   **Advanced Forensic Audits:** Generates comprehensive, perfectly formatted PDF audit reports for every attempt. It permanently solves shuffled-index grading issues and prevents page-break clipping for easy administrative review.
*   **YouTube-Style Tag Inputs:** Advanced UI/UX for CNIC white-listing, allowing organizers to easily whitelist participants with strict format validation (XXXXX-XXXXXXX-X).
*   **Dark Mode & Glassmorphism UI:** A sleek, fully responsive design system utilizing Tailwind CSS that adapts to user preferences.

## 🛠️ Technology Stack

*   **Frontend Ecosystem:** React.js, Vite, TypeScript
*   **Styling & UI:** Tailwind CSS, Framer Motion, Lucide React Icons
*   **Backend & Database:** Firebase (Firestore NoSQL) - *Highly optimized for read/write efficiency*
*   **Security Shell:** Progressive Web App (PWA) architecture with Service Workers
*   **Deployment & Hosting:** Cloudflare Pages & GitHub Actions

---

## 🚀 Run Locally

**Prerequisites:** You must have [Node.js](https://nodejs.org/) installed on your machine.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/aqeelafzal7/ArenaHub.git](https://github.com/aqeelafzal7/ArenaHub.git)
   cd ArenaHub
