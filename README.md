<div align="center">
  <br />
  <p>
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-sky-400">
        <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M2 7L12 12L22 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M12 12V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M17 4.5L7 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  </p>
  <h1 align="center">ZapFlow AI</h1>
  <p align="center">
    A powerful, open-source CRM and WhatsApp Campaign Manager built to automate conversations, manage contacts, and launch marketing campaigns with the power of AI.
  </p>
  <br />
</div>

## ✨ Overview

ZapFlow AI is a comprehensive solution for businesses looking to leverage the WhatsApp Business API. It combines a feature-rich CRM with a powerful automation engine, allowing users to manage customer relationships, execute targeted marketing campaigns, and build complex conversational flows without writing any code.

The platform is built on a modern, serverless architecture using Vercel, Supabase, and React, ensuring scalability, real-time functionality, and a seamless developer experience.

---

## 🚀 Key Features

- **📊 Dashboard:** Get a bird's-eye view of your campaign performance with key metrics like delivery rates, read rates, and total recipients.
- **💬 Real-time Inbox:** Engage in two-way conversations with your contacts in a familiar, real-time chat interface.
- **👥 Contact Management:** Effortlessly create, edit, and segment your contacts. Import your existing lists via CSV and organize them with custom tags.
- **🤖 AI-Powered Template Editor:** Use Google's Gemini API to automatically generate compliant and effective WhatsApp message templates based on your company profile and campaign goals.
- **📢 Campaign Manager:** Launch targeted messaging campaigns to your entire contact list or specific segments based on tags.
- **⚡ Visual Automation Builder:** Create powerful, no-code workflows. Use triggers like `Message Received`, `Tag Added`, or `Webhook` to initiate a series of actions like sending templates, adding tags, or making HTTP requests to external systems.
- **🏆 Sales Funnel (CRM):** Visualize your sales process with a Kanban-style pipeline. Create deals, associate them with contacts, and drag-and-drop them through customizable stages.
- **⚙️ Secure Integration:** Easily configure your Meta WhatsApp Business API credentials and webhooks in a secure environment.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, `@xyflow/react` (for the automation editor).
- **Backend:** Vercel Serverless Functions (Node.js).
- **Database & Auth:** Supabase (PostgreSQL, Authentication, Realtime Subscriptions).
- **AI & APIs:**
  - **Meta WhatsApp Business API:** For sending and receiving messages.
  - **Google Gemini API:** For AI-powered template generation.
  - **hCaptcha:** For secure user authentication.

---

## 🏁 Getting Started

Follow these steps to set up and run your own instance of ZapFlow AI.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- A [Supabase](https://supabase.com/) account (free tier is sufficient to start).
- A [Vercel](https://vercel.com/) account for deployment.
- A [Meta for Developers](https://developers.facebook.com/) account with a WhatsApp Business App configured.
- A [Google AI Studio](https://aistudio.google.com/) account to obtain a Gemini API key.
- An [hCaptcha](https://www.hcaptcha.com/) account for a site key and secret key.

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/zapflow-ai.git
cd zapflow-ai
```

### Step 2: Set Up Supabase

1.  **Create a Project:** Log in to your Supabase account and create a new project.
2.  **Database Schema:** Navigate to the **SQL Editor** in your Supabase project dashboard. You will need to run SQL scripts to create all the necessary tables, functions, and row-level security (RLS) policies.
    *   *Note: A `setup.sql` file containing the complete schema should be created from the project's database structure.*
3.  **Get Credentials:** Go to **Project Settings > API**. You will need the **Project URL** and the `anon` **public** key for the next steps. You will also need the `service_role` **secret** key.

### Step 3: Configure Environment Variables

Create a `.env` file in the root of your project or configure these variables directly in your Vercel project settings.

```env
# Supabase
VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_SECRET

# Google Gemini AI
API_KEY=YOUR_GEMINI_API_KEY

# hCaptcha
VITE_HCAPTCHA_SITEKEY=YOUR_HCAPTCHA_SITE_KEY
HCAPTCHA_SECRET=YOUR_HCAPTCHA_SECRET_KEY
```

### Step 4: Deploy to Vercel

1.  Create a new project on Vercel and link your cloned GitHub repository.
2.  During the setup, Vercel will prompt you to enter the Environment Variables from the step above.
3.  Deploy the project. Vercel will automatically build the React app and deploy the serverless functions from the `api` directory.

### Step 5: Configure the Meta Webhook

1.  Once your project is deployed, Vercel will provide you with a production URL (e.g., `https://your-project.vercel.app`).
2.  Go to your app's dashboard on the Meta for Developers portal.
3.  Navigate to **WhatsApp > Configuration**.
4.  Find the **Webhook** section and click **Edit**.
5.  Set the **Callback URL** to:
    `https://<YOUR_VERCEL_URL>/api/webhook/<YOUR_SUPABASE_USER_ID>`
    *   You can find your Supabase User ID in the `auth.users` table after you sign up for the first time.
6.  Set the **Verify token** to a secure, random string that you will save in your profile settings within the app.
7.  Click **Verify and save**.
8.  In the same section, click **Manage** and subscribe to the `messages` webhook field. This is crucial for receiving message status updates and replies.

### Step 6: Run Locally (Optional)

You can run the application locally using the Vercel CLI for an environment that mirrors production.

```bash
npm install -g vercel
npm install
vercel dev
```

The application will be available at `http://localhost:3000`.

---

## 🏛️ Architecture

The application is architected around a modern, serverless stack that separates the frontend, backend logic, and database.

-   **Frontend (React SPA):** A fully-featured Single Page Application built with React that provides the entire user experience. It communicates with the backend via API calls and receives real-time updates from Supabase.
-   **Backend (Vercel Serverless Functions):** A collection of independent, auto-scaling functions located in the `/api` directory.
    -   `/api/webhook/[id]`: The main entry point for all incoming data from the Meta WhatsApp API, handling message replies and status updates.
    -   `/api/trigger/[id]`: A generic webhook endpoint for starting automations from external systems.
    -   `/api/generate-template`: A secure, server-side function that communicates with the Google Gemini API.
-   **Database (Supabase):**
    -   **PostgreSQL:** The core database for storing all application data.
    -   **Auth:** Manages user sign-up, login, and session management with integrated hCaptcha for security.
    -   **Realtime:** Pushes live database changes to the connected clients, enabling features like the real-time inbox without manual polling.

---

## 🔄 Core Workflows

-   **Receiving a Message:**
    1.  A user replies to your WhatsApp number.
    2.  Meta sends a POST request to your `/api/webhook/[id]` endpoint.
    3.  The serverless function identifies the contact, saves the message to the Supabase database, and triggers a `new_message` broadcast.
    4.  The frontend, subscribed to Supabase Realtime, receives the broadcast and instantly updates the Inbox UI.
    5.  The function also checks for any automation triggers (e.g., matching a keyword) and initiates the corresponding workflow.

-   **Running an Automation:**
    1.  An event occurs (e.g., a webhook is received, a tag is added).
    2.  The `trigger-handler.ts` identifies the relevant automation(s).
    3.  The `engine.ts` takes over, processing the automation's nodes and edges sequentially.
    4.  For each action node, the corresponding handler function is executed (e.g., sending a message via the Meta API, updating the contact in the database).
    5.  All execution steps are logged for debugging and analytics.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to fork the repository, make changes, and submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.