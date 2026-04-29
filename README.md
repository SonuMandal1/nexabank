# 🏦 NexaBank — Full Stack Bank Management System

## Features
- JWT Authentication (Login/Register)
- Multi-account management (Savings, Checking, Fixed Deposit)
- Deposits, Withdrawals, Fund Transfers
- Loan Management (Apply, EMI Calculator, Repayment)
- Payment Cards (Debit, Credit, Platinum, Virtual)
- Beneficiary Management
- Real-time Notifications
- Admin Panel (User management, Loan approvals, Transaction monitoring)
- SQLite persistent database
- Spending Analytics Chart

## Setup & Run

### Prerequisites
- Node.js v16+ installed

### Steps

```bash
# 1. Go to backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

### Open the App
Visit: http://localhost:5000

### Demo Credentials
- **Admin:** admin@nexabank.com / admin123
- **Register** a new user to get a $1,000 welcome bonus!

## Project Structure
```
bank_management_system/
├── backend/
│   ├── server.js        # Express API + SQLite
│   ├── package.json
│   └── nexabank.db      # Auto-created on first run
└── frontend/
    ├── index.html       # Login / Register page
    └── dashboard.html   # Full banking dashboard
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/accounts | Get user accounts |
| POST | /api/accounts | Open new account |
| POST | /api/transactions/deposit | Deposit funds |
| POST | /api/transactions/withdraw | Withdraw funds |
| POST | /api/transactions/transfer | Transfer funds |
| GET | /api/loans | Get loans |
| POST | /api/loans | Apply for loan |
| POST | /api/loans/:id/pay | Make loan payment |
| GET | /api/cards | Get cards |
| POST | /api/cards | Issue new card |
| GET | /api/admin/stats | Admin stats |
| GET | /api/admin/users | All users (admin) |
| PUT | /api/admin/loans/:id | Approve/reject loan (admin) |
