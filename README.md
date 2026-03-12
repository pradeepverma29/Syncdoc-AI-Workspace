# SyncDoc – Real-Time Collaborative Workspace

SyncDoc is a full-stack collaborative document editing platform that allows multiple users to work on the same document simultaneously.  
The project focuses on solving real-time synchronization, controlled user access, and AI-assisted document editing using modern web technologies.

---

# Project Overview

The application enables users to:

- Create and manage documents
- Collaborate with multiple users in real time
- Chat within document workspace
- Upload files related to documents
- Use AI assistance for writing improvements

The main objective of this project is to implement real-time concurrency handling and a role-based access control system in a scalable architecture.

---

# System Architecture

### Frontend
- React (TypeScript)
- Tailwind CSS for styling
- Tiptap rich text editor
- Vite development environment

The frontend manages UI rendering, editor interaction, and real-time updates received through WebSockets.

### Backend
- Node.js with Express
- REST APIs for authentication and document management
- Socket.io server for real-time communication

### Database
- MongoDB with Mongoose ORM
- Stores users, documents, permissions, and messages.

### AI Integration
- Gemini API is used to provide:
  - grammar correction
  - summarization
  - AI-generated document titles
  - custom prompt assistance

---

# Real-Time Concurrency Handling

Simultaneous editing is implemented using **Socket.io**.

Each document acts as an independent socket room:

1. When a user opens a document, they join its socket room.
2. Editor changes are emitted as update events.
3. The server broadcasts updates to all connected users except the sender.
4. Clients immediately update their editor state upon receiving changes.

Key design decisions:

- Only incremental changes (editor updates) are transmitted instead of full document data.
- Updates are applied in arrival order to reduce conflicts.
- Real-time broadcasting ensures low latency collaboration.

This approach allows multiple users to edit the same document smoothly without manual refresh.

---

# Role-Based Access Control (RBAC)

Access permissions are managed using a role-based system stored in the database.

Each document contains a list of collaborators:


### Permission Rules

- **Owner**
  - Full control
  - Manage collaborators
  - Edit and delete document

- **Editor**
  - Edit document content
  - View document

- **Viewer**
  - Read-only access

Authorization middleware verifies user roles before executing protected API actions, ensuring secure collaboration.

---

# Key Features

- Real-time collaborative editing
- Rich text editor interface
- Document-specific chat system
- Secure authentication using JWT
- File upload and management
- AI-powered writing assistance
- Permission-based document sharing

---

# Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB database
- Gemini API Key

### Installation

1. Install dependencies:

```bash
npm install

2. Create .env file in project root:
.env:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_api_key

3. Start Development Server:

```bash
npm run dev

Application runs at:
https://localhost:3000
