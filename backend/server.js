/**
 * NexaBank Server
 * Uses sql.js — pure JavaScript SQLite, NO C++ compilation needed.
 * Works on Node 22 Windows/Mac/Linux without Visual Studio or build tools.
 */

const express        = require('express');
const initSqlJs      = require('sql.js');
const bcrypt         = require('bcryptjs');
const jwt            = require('jsonwebtoken');
const cors           = require('cors');
const { v4: uuidv4 } = require('uuid');
const path           = require('path');
const fs             = require('fs');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'nexabank_super_secret_jwt_key_2024';
const DB_PATH    = path.join(__dirname, 'nexabank.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Database ────────────────────────────────────────────────────────────────
let db;

function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (e) { console.error('DB save error:', e.message); }
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  try { stmt.bind(params); return stmt.step() ? stmt.getAsObject() : null; }
  finally { stmt.free(); }
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally { stmt.free(); }
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function dbTransaction(fn) {
  db.run('BEGIN TRANSACTION');
  try {
    const r = fn();
    db.run('COMMIT');
    saveDb();
    return r;
  } catch (e) { db.run('ROLLBACK'); throw e; }
}

function createSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, phone TEXT, address TEXT,
    avatar_color TEXT DEFAULT '#c9a84c', role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_number TEXT UNIQUE NOT NULL,
    account_type TEXT NOT NULL, balance REAL DEFAULT 0, currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, from_account TEXT, to_account TEXT, user_id TEXT NOT NULL,
    type TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL, description TEXT,
    status TEXT DEFAULT 'completed', created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, loan_type TEXT NOT NULL,
    amount REAL NOT NULL, interest_rate REAL NOT NULL, duration_months INTEGER NOT NULL,
    monthly_payment REAL NOT NULL, remaining_balance REAL NOT NULL, paid_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT NOT NULL,
    card_number TEXT UNIQUE NOT NULL, card_holder TEXT NOT NULL, card_type TEXT NOT NULL,
    expiry_month INTEGER NOT NULL, expiry_year INTEGER NOT NULL, cvv TEXT NOT NULL,
    credit_limit REAL DEFAULT 0, status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
    message TEXT NOT NULL, type TEXT DEFAULT 'info', read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
    account_number TEXT NOT NULL, bank_name TEXT DEFAULT 'NexaBank',
    created_at DATETIME DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  saveDb();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const genAccNum  = () => '10' + Date.now().toString().slice(-8) + Math.floor(Math.random()*100).toString().padStart(2,'0');
const genCardNum = () => ('4'+Array.from({length:15},()=>Math.floor(Math.random()*10)).join('')).match(/.{4}/g).join(' ');
const calcEMI    = (p, r, n) => { const m=r/100/12; return (p*m*Math.pow(1+m,n))/(Math.pow(1+m,n)-1); };

function notify(userId, title, message, type = 'info') {
  dbRun(`INSERT INTO notifications (id, user_id, title, message, type) VALUES (?,?,?,?,?)`,
        [uuidv4(), userId, title, message, type]);
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const t = req.headers['authorization']?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'No token provided.' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(403).json({ error: 'Invalid or expired token.' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (dbGet('SELECT id FROM users WHERE email=?', [email]))
      return res.status(400).json({ error: 'Email already registered.' });

    const uid = uuidv4();
    const colors = ['#c9a84c','#4fc3f7','#7c3aed','#10b981','#f59e0b','#ef4444'];
    const ac = colors[Math.floor(Math.random()*colors.length)];
    dbRun(`INSERT INTO users (id,name,email,password,phone,avatar_color) VALUES (?,?,?,?,?,?)`,
          [uid, name, email, bcrypt.hashSync(password, 10), phone||null, ac]);

    const aid = uuidv4(), accNum = genAccNum();
    dbRun(`INSERT INTO accounts (id,user_id,account_number,account_type,balance) VALUES (?,?,?,?,?)`,
          [aid, uid, accNum, 'savings', 1000]);
    dbRun(`INSERT INTO transactions (id,to_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?)`,
          [uuidv4(), aid, uid, 'deposit', 1000, 1000, 'Welcome bonus credit']);
    notify(uid,'🎉 Welcome to NexaBank!',`Savings account ${accNum} created with $1,000 welcome bonus!`,'success');

    const token = jwt.sign({ id:uid, email, role:'user', name }, JWT_SECRET, { expiresIn:'7d' });
    res.status(201).json({ message:'Registration successful!', token, user:{ id:uid, name, email, role:'user', avatar_color:ac } });
  } catch(e) { console.error(e); res.status(500).json({ error:'Server error.' }); }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
    const user = dbGet('SELECT * FROM users WHERE email=?', [email]);
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Contact support.' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'Invalid email or password.' });
    const token = jwt.sign({ id:user.id, email:user.email, role:user.role, name:user.name }, JWT_SECRET, { expiresIn:'7d' });
    res.json({ message:'Login successful!', token, user:{ id:user.id, name:user.name, email:user.email, role:user.role, avatar_color:user.avatar_color } });
  } catch(e) { res.status(500).json({ error:'Server error.' }); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/users/me', auth, (req, res) => {
  res.json(dbGet('SELECT id,name,email,phone,address,role,status,avatar_color,created_at FROM users WHERE id=?',[req.user.id]));
});
app.put('/api/users/profile', auth, (req, res) => {
  const { name, phone, address } = req.body;
  if (!name) return res.status(400).json({ error:'Name required.' });
  dbRun('UPDATE users SET name=?,phone=?,address=? WHERE id=?',[name,phone||null,address||null,req.user.id]);
  notify(req.user.id,'Profile Updated','Your profile has been updated.','info');
  res.json({ message:'Profile updated.' });
});
app.put('/api/users/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error:'Both passwords required.' });
  if (newPassword.length < 6) return res.status(400).json({ error:'Min 6 characters.' });
  const user = dbGet('SELECT * FROM users WHERE id=?',[req.user.id]);
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(400).json({ error:'Current password incorrect.' });
  dbRun('UPDATE users SET password=? WHERE id=?',[bcrypt.hashSync(newPassword,10),req.user.id]);
  notify(req.user.id,'Password Changed','Your password was changed. Contact support if this was not you.','warning');
  res.json({ message:'Password changed.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/accounts', auth, (req,res) =>
  res.json(dbAll('SELECT * FROM accounts WHERE user_id=? ORDER BY created_at ASC',[req.user.id])));

app.post('/api/accounts', auth, (req, res) => {
  const { account_type } = req.body;
  if (!['savings','checking','fixed_deposit'].includes(account_type))
    return res.status(400).json({ error:'Invalid account type.' });
  if ((dbGet('SELECT COUNT(*) AS c FROM accounts WHERE user_id=?',[req.user.id])?.c||0) >= 5)
    return res.status(400).json({ error:'Max 5 accounts allowed.' });
  const id=uuidv4(), num=genAccNum();
  dbRun(`INSERT INTO accounts (id,user_id,account_number,account_type,balance) VALUES (?,?,?,?,?)`,[id,req.user.id,num,account_type,0]);
  notify(req.user.id,'New Account Opened',`Your ${account_type.replace('_',' ')} account (${num}) is open.`,'success');
  res.status(201).json({ message:'Account created!', accountId:id, accountNumber:num });
});

// ═══════════════════════════════════════════════════════════════════════════
//  TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/transactions', auth, (req, res) => {
  const { account_id, type, limit=50, offset=0 } = req.query;
  let sql=`SELECT t.*,a1.account_number AS from_acc_num,a2.account_number AS to_acc_num
           FROM transactions t
           LEFT JOIN accounts a1 ON t.from_account=a1.id
           LEFT JOIN accounts a2 ON t.to_account=a2.id
           WHERE t.user_id=?`;
  const p=[req.user.id];
  if(account_id){sql+=' AND (t.from_account=? OR t.to_account=?)';p.push(account_id,account_id);}
  if(type){sql+=' AND t.type=?';p.push(type);}
  sql+=' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  p.push(parseInt(limit),parseInt(offset));
  res.json(dbAll(sql,p));
});

app.get('/api/transactions/summary', auth, (req, res) => {
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const income =dbGet(`SELECT COALESCE(SUM(amount),0) AS t FROM transactions WHERE user_id=? AND type IN ('deposit','loan_disbursement') AND strftime('%Y-%m',created_at)=?`,[req.user.id,m])?.t||0;
    const expense=dbGet(`SELECT COALESCE(SUM(amount),0) AS t FROM transactions WHERE user_id=? AND type IN ('withdraw','transfer','loan_payment') AND strftime('%Y-%m',created_at)=?`,[req.user.id,m])?.t||0;
    months.push({ month:d.toLocaleString('default',{month:'short'}), income, expense });
  }
  res.json(months);
});

app.post('/api/transactions/deposit', auth, (req, res) => {
  const { account_id, amount, description } = req.body;
  const amt=parseFloat(amount);
  if(!amt||amt<=0||amt>1000000) return res.status(400).json({error:'Amount must be $0.01–$1,000,000.'});
  const acc=dbGet('SELECT * FROM accounts WHERE id=? AND user_id=?',[account_id,req.user.id]);
  if(!acc) return res.status(404).json({error:'Account not found.'});
  if(acc.status!=='active') return res.status(400).json({error:'Account not active.'});
  const bal=acc.balance+amt;
  dbRun('UPDATE accounts SET balance=? WHERE id=?',[bal,account_id]);
  const txId=uuidv4();
  dbRun(`INSERT INTO transactions (id,to_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?)`,[txId,account_id,req.user.id,'deposit',amt,bal,description||'Cash Deposit']);
  notify(req.user.id,'💰 Deposit Successful',`$${amt.toLocaleString()} deposited. Balance: $${bal.toLocaleString()}`,'success');
  res.json({ message:'Deposit successful!', newBalance:bal, transactionId:txId });
});

app.post('/api/transactions/withdraw', auth, (req, res) => {
  const { account_id, amount, description } = req.body;
  const amt=parseFloat(amount);
  if(!amt||amt<=0) return res.status(400).json({error:'Invalid amount.'});
  const acc=dbGet('SELECT * FROM accounts WHERE id=? AND user_id=?',[account_id,req.user.id]);
  if(!acc) return res.status(404).json({error:'Account not found.'});
  if(acc.status!=='active') return res.status(400).json({error:'Account not active.'});
  if(acc.balance<amt) return res.status(400).json({error:`Insufficient balance. Available: $${acc.balance.toFixed(2)}`});
  const bal=acc.balance-amt;
  dbRun('UPDATE accounts SET balance=? WHERE id=?',[bal,account_id]);
  const txId=uuidv4();
  dbRun(`INSERT INTO transactions (id,from_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?)`,[txId,account_id,req.user.id,'withdraw',amt,bal,description||'Cash Withdrawal']);
  notify(req.user.id,'🏧 Withdrawal Processed',`$${amt.toLocaleString()} withdrawn. Balance: $${bal.toLocaleString()}`,'info');
  res.json({ message:'Withdrawal successful!', newBalance:bal, transactionId:txId });
});

app.post('/api/transactions/transfer', auth, (req, res) => {
  const { from_account_id, to_account_number, amount, description } = req.body;
  const amt=parseFloat(amount);
  if(!amt||amt<=0) return res.status(400).json({error:'Invalid amount.'});
  if(!to_account_number) return res.status(400).json({error:'Destination account required.'});
  const from=dbGet('SELECT * FROM accounts WHERE id=? AND user_id=?',[from_account_id,req.user.id]);
  if(!from) return res.status(404).json({error:'Source account not found.'});
  if(from.status!=='active') return res.status(400).json({error:'Source account not active.'});
  if(from.balance<amt) return res.status(400).json({error:`Insufficient balance. Available: $${from.balance.toFixed(2)}`});
  const to=dbGet("SELECT * FROM accounts WHERE account_number=? AND status='active'",[to_account_number.trim()]);
  if(!to) return res.status(404).json({error:'Destination account not found.'});
  if(to.id===from_account_id) return res.status(400).json({error:'Cannot transfer to same account.'});
  const fBal=from.balance-amt, tBal=to.balance+amt;
  const txId=dbTransaction(()=>{
    dbRun('UPDATE accounts SET balance=? WHERE id=?',[fBal,from_account_id]);
    dbRun('UPDATE accounts SET balance=? WHERE id=?',[tBal,to.id]);
    const id=uuidv4();
    dbRun(`INSERT INTO transactions (id,from_account,to_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?,?)`,[id,from_account_id,to.id,req.user.id,'transfer',amt,fBal,description||`Transfer to ${to_account_number}`]);
    if(to.user_id!==req.user.id) notify(to.user_id,'💸 Money Received',`$${amt.toLocaleString()} received in account ${to_account_number}.`,'success');
    notify(req.user.id,'✅ Transfer Successful',`$${amt.toLocaleString()} sent to ${to_account_number}. Balance: $${fBal.toLocaleString()}`,'success');
    return id;
  });
  const recip=dbGet('SELECT name FROM users WHERE id=?',[to.user_id]);
  res.json({ message:'Transfer successful!', newBalance:fBal, transactionId:txId, recipientName:recip?.name||'Account Holder' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  LOANS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/loans', auth, (req,res) =>
  res.json(dbAll('SELECT * FROM loans WHERE user_id=? ORDER BY created_at DESC',[req.user.id])));

app.post('/api/loans', auth, (req, res) => {
  const { loan_type, amount, duration_months } = req.body;
  const rates={personal:12.5,home:7.5,auto:9.0,education:6.5,business:11.0};
  if(!rates[loan_type]) return res.status(400).json({error:'Invalid loan type.'});
  const amt=parseFloat(amount), dur=parseInt(duration_months);
  if(!amt||amt<100) return res.status(400).json({error:'Min loan $100.'});
  if(!dur||dur<3||dur>360) return res.status(400).json({error:'Duration 3–360 months.'});
  if((dbGet("SELECT COUNT(*) AS c FROM loans WHERE user_id=? AND status IN ('pending','active')",[req.user.id])?.c||0)>=3)
    return res.status(400).json({error:'Max 3 active loans.'});
  const rate=rates[loan_type], emi=calcEMI(amt,rate,dur), id=uuidv4();
  dbRun(`INSERT INTO loans (id,user_id,loan_type,amount,interest_rate,duration_months,monthly_payment,remaining_balance) VALUES (?,?,?,?,?,?,?,?)`,[id,req.user.id,loan_type,amt,rate,dur,emi.toFixed(2),amt]);
  notify(req.user.id,'📋 Loan Application Submitted',`${loan_type} loan for $${amt.toLocaleString()} is pending review. EMI: $${emi.toFixed(2)}`,'info');
  res.status(201).json({ message:'Loan application submitted!', loanId:id, monthlyPayment:emi.toFixed(2), interestRate:rate });
});

app.post('/api/loans/:id/pay', auth, (req, res) => {
  const { account_id, amount } = req.body;
  const amt=parseFloat(amount);
  if(!amt||amt<=0) return res.status(400).json({error:'Invalid amount.'});
  const loan=dbGet("SELECT * FROM loans WHERE id=? AND user_id=? AND status='active'",[req.params.id,req.user.id]);
  if(!loan) return res.status(404).json({error:'Active loan not found.'});
  const acc=dbGet('SELECT * FROM accounts WHERE id=? AND user_id=?',[account_id,req.user.id]);
  if(!acc) return res.status(404).json({error:'Account not found.'});
  if(acc.balance<amt) return res.status(400).json({error:'Insufficient balance.'});
  const newBal=acc.balance-amt, rem=Math.max(0,loan.remaining_balance-amt), paid=loan.paid_amount+amt;
  const status=rem<=0?'paid':'active';
  dbRun('UPDATE accounts SET balance=? WHERE id=?',[newBal,account_id]);
  dbRun('UPDATE loans SET remaining_balance=?,paid_amount=?,status=? WHERE id=?',[rem,paid,status,loan.id]);
  dbRun(`INSERT INTO transactions (id,from_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?)`,[uuidv4(),account_id,req.user.id,'loan_payment',amt,newBal,`${loan.loan_type} loan repayment`]);
  if(status==='paid') notify(req.user.id,'🎊 Loan Fully Paid!',`Congrats! Your ${loan.loan_type} loan of $${loan.amount.toLocaleString()} is fully repaid.`,'success');
  else notify(req.user.id,'✅ Loan Payment','Remaining: $'+rem.toFixed(2),'info');
  res.json({ message:`Payment successful!${status==='paid'?' Loan fully repaid! 🎉':''}`, remainingBalance:rem, loanStatus:status, accountBalance:newBal });
});

// ═══════════════════════════════════════════════════════════════════════════
//  CARDS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/cards', auth, (req,res) =>
  res.json(dbAll(`SELECT c.*,a.account_number FROM cards c JOIN accounts a ON c.account_id=a.id WHERE c.user_id=? ORDER BY c.created_at DESC`,[req.user.id])));

app.post('/api/cards', auth, (req, res) => {
  const { account_id, card_type } = req.body;
  if(!['debit','credit','platinum','virtual'].includes(card_type)) return res.status(400).json({error:'Invalid card type.'});
  const acc=dbGet('SELECT * FROM accounts WHERE id=? AND user_id=?',[account_id,req.user.id]);
  if(!acc) return res.status(404).json({error:'Account not found.'});
  if((dbGet('SELECT COUNT(*) AS c FROM cards WHERE user_id=?',[req.user.id])?.c||0)>=5) return res.status(400).json({error:'Max 5 cards.'});
  const user=dbGet('SELECT name FROM users WHERE id=?',[req.user.id]);
  const now=new Date(), limits={debit:0,virtual:0,credit:5000,platinum:15000};
  const id=uuidv4();
  dbRun(`INSERT INTO cards (id,user_id,account_id,card_number,card_holder,card_type,expiry_month,expiry_year,cvv,credit_limit) VALUES (?,?,?,?,?,?,?,?,?,?)`,[id,req.user.id,account_id,genCardNum(),user.name.toUpperCase(),card_type,now.getMonth()+1,now.getFullYear()+5,Math.floor(100+Math.random()*900).toString(),limits[card_type]||0]);
  notify(req.user.id,'💳 New Card Issued',`Your ${card_type} card is ready to use.`,'success');
  res.status(201).json({ message:'Card created!', cardId:id });
});

app.put('/api/cards/:id/status', auth, (req, res) => {
  const { status } = req.body;
  if(!['active','blocked','frozen'].includes(status)) return res.status(400).json({error:'Invalid status.'});
  const card=dbGet('SELECT * FROM cards WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if(!card) return res.status(404).json({error:'Card not found.'});
  dbRun('UPDATE cards SET status=? WHERE id=?',[status,req.params.id]);
  notify(req.user.id,`Card ${status.charAt(0).toUpperCase()+status.slice(1)}`,`Your card ending in ${card.card_number.slice(-4)} is now ${status}.`,status==='active'?'success':'warning');
  res.json({ message:`Card ${status}.` });
});

// ═══════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/notifications', auth, (req,res) =>
  res.json(dbAll('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30',[req.user.id])));
app.get('/api/notifications/unread-count', auth, (req,res) =>
  res.json({ count: dbGet('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND read=0',[req.user.id])?.c||0 }));
app.put('/api/notifications/read-all', auth, (req,res) => {
  dbRun('UPDATE notifications SET read=1 WHERE user_id=?',[req.user.id]);
  res.json({ message:'All read.' });
});
app.put('/api/notifications/:id/read', auth, (req,res) => {
  dbRun('UPDATE notifications SET read=1 WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  res.json({ message:'Read.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BENEFICIARIES
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/beneficiaries', auth, (req,res) =>
  res.json(dbAll('SELECT * FROM beneficiaries WHERE user_id=? ORDER BY name ASC',[req.user.id])));

app.post('/api/beneficiaries', auth, (req, res) => {
  const { name, account_number, bank_name } = req.body;
  if(!name||!account_number) return res.status(400).json({error:'Name and account number required.'});
  if(!dbGet("SELECT id FROM accounts WHERE account_number=? AND status='active'",[account_number]))
    return res.status(404).json({error:'Account not found in NexaBank.'});
  if(dbGet('SELECT id FROM beneficiaries WHERE user_id=? AND account_number=?',[req.user.id,account_number]))
    return res.status(400).json({error:'Beneficiary already added.'});
  dbRun(`INSERT INTO beneficiaries (id,user_id,name,account_number,bank_name) VALUES (?,?,?,?,?)`,[uuidv4(),req.user.id,name,account_number,bank_name||'NexaBank']);
  res.status(201).json({ message:'Beneficiary added!' });
});

app.delete('/api/beneficiaries/:id', auth, (req,res) => {
  dbRun('DELETE FROM beneficiaries WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  res.json({ message:'Removed.' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/admin/stats', auth, adminOnly, (req, res) => res.json({
  totalUsers:        dbGet("SELECT COUNT(*) AS c FROM users WHERE role='user'")?.c||0,
  activeUsers:       dbGet("SELECT COUNT(*) AS c FROM users WHERE role='user' AND status='active'")?.c||0,
  totalAccounts:     dbGet('SELECT COUNT(*) AS c FROM accounts')?.c||0,
  totalBalance:      dbGet('SELECT COALESCE(SUM(balance),0) AS t FROM accounts')?.t||0,
  totalTransactions: dbGet('SELECT COUNT(*) AS c FROM transactions')?.c||0,
  pendingLoans:      dbGet("SELECT COUNT(*) AS c FROM loans WHERE status='pending'")?.c||0,
  activeLoans:       dbGet("SELECT COUNT(*) AS c FROM loans WHERE status='active'")?.c||0,
  totalLoanAmount:   dbGet("SELECT COALESCE(SUM(amount),0) AS t FROM loans WHERE status IN ('active','paid')")?.t||0,
  totalCards:        dbGet('SELECT COUNT(*) AS c FROM cards')?.c||0,
  todayTransactions: dbGet("SELECT COUNT(*) AS c FROM transactions WHERE date(created_at)=date('now')")?.c||0
}));

app.get('/api/admin/users', auth, adminOnly, (req,res) =>
  res.json(dbAll('SELECT id,name,email,phone,role,status,avatar_color,created_at FROM users ORDER BY created_at DESC')));

app.put('/api/admin/users/:id/status', auth, adminOnly, (req, res) => {
  const { status } = req.body;
  if(!['active','suspended'].includes(status)) return res.status(400).json({error:'Invalid status.'});
  if(req.params.id===req.user.id) return res.status(400).json({error:'Cannot modify your own account.'});
  dbRun('UPDATE users SET status=? WHERE id=?',[status,req.params.id]);
  res.json({ message:`User ${status}.` });
});

app.get('/api/admin/loans', auth, adminOnly, (req,res) =>
  res.json(dbAll(`SELECT l.*,u.name AS user_name,u.email AS user_email FROM loans l JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC`)));

app.put('/api/admin/loans/:id', auth, adminOnly, (req, res) => {
  const { action } = req.body;
  if(!['approve','reject'].includes(action)) return res.status(400).json({error:'Invalid action.'});
  const loan=dbGet("SELECT * FROM loans WHERE id=? AND status='pending'",[req.params.id]);
  if(!loan) return res.status(404).json({error:'Pending loan not found.'});
  if(action==='approve'){
    dbRun("UPDATE loans SET status='active' WHERE id=?",[loan.id]);
    const acc=dbGet("SELECT * FROM accounts WHERE user_id=? AND status='active' ORDER BY created_at ASC LIMIT 1",[loan.user_id]);
    if(acc){
      const nb=acc.balance+loan.amount;
      dbRun('UPDATE accounts SET balance=? WHERE id=?',[nb,acc.id]);
      dbRun(`INSERT INTO transactions (id,to_account,user_id,type,amount,balance_after,description) VALUES (?,?,?,?,?,?,?)`,[uuidv4(),acc.id,loan.user_id,'loan_disbursement',loan.amount,nb,`${loan.loan_type} loan disbursement`]);
    }
    notify(loan.user_id,'🎉 Loan Approved!',`Your ${loan.loan_type} loan of $${loan.amount.toLocaleString()} has been approved and disbursed!`,'success');
  } else {
    dbRun("UPDATE loans SET status='rejected' WHERE id=?",[loan.id]);
    notify(loan.user_id,'❌ Loan Rejected',`Your ${loan.loan_type} loan for $${loan.amount.toLocaleString()} was rejected.`,'error');
  }
  res.json({ message:`Loan ${action}d.` });
});

app.get('/api/admin/transactions', auth, adminOnly, (req,res) =>
  res.json(dbAll(`SELECT t.*,u.name AS user_name,a1.account_number AS from_num,a2.account_number AS to_num FROM transactions t JOIN users u ON t.user_id=u.id LEFT JOIN accounts a1 ON t.from_account=a1.id LEFT JOIN accounts a2 ON t.to_account=a2.id ORDER BY t.created_at DESC LIMIT 100`)));

// ─── Frontend fallback ────────────────────────────────────────────────────────
app.get('/dashboard',(_,res)=>res.sendFile(path.join(__dirname,'../frontend/dashboard.html')));
app.get('*',         (_,res)=>res.sendFile(path.join(__dirname,'../frontend/index.html')));

// ═══════════════════════════════════════════════════════════════════════════
//  BOOTSTRAP — async because sql.js init is async
// ═══════════════════════════════════════════════════════════════════════════
async function bootstrap() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('📂 Loaded existing database.');
  } else {
    db = new SQL.Database();
    console.log('🆕 Created new database.');
  }

  createSchema();

  // Seed admin
  if (!dbGet('SELECT id FROM users WHERE email=?',['admin@nexabank.com'])) {
    const aid = uuidv4();
    dbRun(`INSERT INTO users (id,name,email,password,role,phone) VALUES (?,?,?,?,?,?)`,[aid,'System Administrator','admin@nexabank.com',bcrypt.hashSync('admin123',10),'admin','+1-800-NEXABANK']);
    console.log('✅ Admin created: admin@nexabank.com / admin123');
  }

  setInterval(saveDb, 30_000); // auto-save every 30s

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║        NexaBank Server Running  🚀           ║
║   ➜  http://localhost:${PORT}                  ║
╠══════════════════════════════════════════════╣
║  Admin:  admin@nexabank.com / admin123       ║
║  Engine: sql.js (pure JS — no build tools)   ║
╚══════════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch(err => { console.error('Fatal:', err); process.exit(1); });
