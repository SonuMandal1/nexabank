#!/bin/bash
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        NexaBank — Starting Server            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
cd "$(dirname "$0")/backend"
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js v16+ from https://nodejs.org"
  exit 1
fi
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi
echo "🚀 Starting NexaBank..."
echo "   Open: http://localhost:5000"
echo "   Admin: admin@nexabank.com / admin123"
echo ""
npm start
