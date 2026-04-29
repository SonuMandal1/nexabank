# 🏦 NexaBank — Full Stack Bank Management System

> Built as a Full-Stack Web Application | Node.js + Express Backend + HTML/CSS/JS Frontend

![LIVE](https://img.shields.io/badge/STATUS-LIVE-brightgreen?style=for-the-badge)
![BACKEND](https://img.shields.io/badge/BACKEND-Render-46E3B7?style=for-the-badge)
![FRONTEND](https://img.shields.io/badge/FRONTEND-Netlify-00C7B7?style=for-the-badge)
![GITHUB](https://img.shields.io/badge/GITHUB-SonuMandal1-181717?style=for-the-badge&logo=github)

---

## 📖 About This Project

NexaBank is a **production-ready, full-stack Bank Management System** built with a Node.js/Express backend and a clean HTML/CSS/JavaScript frontend. The system allows users to securely register, log in, and perform complete banking operations including deposits, withdrawals, transfers, loan management, and card management through a beautiful, responsive interface.

The project is **fully deployed and live** — both the backend API and the frontend web application are running in production.

---

## 🌐 Live Deployment

| Service | URL |
|---|---|
| 🌐 **Frontend (HTML/JS)** | [https://genuine-sawine-60c513.netlify.app](https://genuine-sawine-60c513.netlify.app) |
| ⚙️ **Backend API (Node.js)** | [https://nexabank-backend-fi1h.onrender.com](https://nexabank-backend-fi1h.onrender.com) |
| 🗄️ **Database** | SQLite (Persistent on Render Disk) |

> ✅ Both backend and frontend are live and fully functional.

---

## ✨ Features Implemented

### 🔐 Authentication
- JWT-based secure login & registration
- Password hashing with bcryptjs
- Protected routes with token verification
- Admin and regular user roles

### 💰 Account Management
- Open multiple account types: **Savings**, **Checking**, **Fixed Deposit**
- Real-time account balance tracking
- Account summary dashboard
- $1,000 welcome bonus on registration

### 💸 Transactions
- Deposit funds into any account
- Withdraw funds with balance validation
- Transfer funds between accounts
- Complete transaction history with timestamps

### 🏦 Loan Management
- Apply for loans with custom amounts and tenure
- EMI calculator
- Loan repayment tracking
- Admin loan approval / rejection system

### 💳 Card Management
- Issue Debit, Credit, Platinum, and Virtual cards
- Card details with masked numbers
- Card status management

### 👥 Beneficiary Management
- Add and manage payment beneficiaries
- Quick transfer to saved beneficiaries

### 🔔 Notifications
- Real-time in-app notifications
- Transaction alerts and system messages

### 📊 Analytics
- Spending analytics chart
- Transaction breakdown by category
- Visual dashboard with account summaries

### 🛡️ Admin Panel
- User management (view all users)
- Loan approval and rejection
- Transaction monitoring
- Platform statistics overview

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite (via sql.js — pure JS, no native build) |
| **Authentication** | JWT (jsonwebtoken), bcryptjs |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend Hosting** | Render (Free Tier) |
| **Frontend Hosting** | Netlify (Free Tier) |
| **Version Control** | Git & GitHub |

---

## 📁 Project Structure

```
bank_management_system/
├── backend/
│   ├── server.js          # Express API + SQLite logic
│   ├── package.json       # Dependencies
│   └── nexabank.db        # Auto-created SQLite database
├── frontend/
│   ├── index.html         # Login / Register page
│   └── dashboard.html     # Full banking dashboard
├── start.sh               # Linux/Mac startup script
├── start.bat              # Windows startup script
└── README.md
```

---

## 🚀 Local Setup & Run

### Prerequisites
- Node.js v16+ installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/SonuMandal1/nexabank.git
cd nexabank

# 2. Go to backend folder
cd backend

# 3. Install dependencies
npm install

# 4. Start the server
npm start
```

### Open the App
Visit: [http://localhost:5000](http://localhost:5000)

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | admin@nexabank.com | admin123 |
| **User** | Register a new account | — |

> New users receive a **$1,000 welcome bonus** on registration!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/accounts` | Get user accounts |
| POST | `/api/accounts` | Open new account |
| POST | `/api/transactions/deposit` | Deposit funds |
| POST | `/api/transactions/withdraw` | Withdraw funds |
| POST | `/api/transactions/transfer` | Transfer funds |
| GET | `/api/loans` | Get loans |
| POST | `/api/loans` | Apply for loan |
| POST | `/api/loans/:id/pay` | Make loan payment |
| GET | `/api/cards` | Get cards |
| POST | `/api/cards` | Issue new card |
| GET | `/api/admin/stats` | Admin stats |
| GET | `/api/admin/users` | All users (admin only) |
| PUT | `/api/admin/loans/:id` | Approve/reject loan (admin only) |

---

## ☁️ Deployment Guide

> Live URLs: Frontend → https://genuine-sawine-60c513.netlify.app | Backend → https://nexabank-backend-fi1h.onrender.com

### Backend → Render
1. Go to [render.com](https://render.com) and sign up with GitHub
2. Create a **New Web Service** → connect this repo
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm start`
6. Add environment variables:
   - `JWT_SECRET` → your secret key
   - `PORT` → `5000`
7. Click **Deploy Web Service**

### Frontend → Netlify
1. Go to [netlify.com](https://netlify.com) and sign up with GitHub
2. Click **Add new project** → Import from GitHub
3. Set **Base directory** to `frontend`
4. Leave Build command empty
5. Click **Deploy**

---

## 👨‍💻 Developer

**Sonu Kumar Mandal**
- GitHub: [@SonuMandal1](https://github.com/SonuMandal1)
- Email: sm2497738@gmail.com

---

## 📄 License

This project is licensed under the MIT License.

| PUT | /api/admin/loans/:id | Approve/reject loan (admin) |
