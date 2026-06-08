#!/bin/bash

# Auto-Trade Local Development Setup & Run Script
# This script sets up MongoDB, installs dependencies, and runs both backend & frontend

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Auto-Trade Setup & Run"
echo "=========================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

# Check if Docker is running
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info > /dev/null 2>&1; then
        error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    info "Docker is running"
}

# Setup MongoDB
setup_mongodb() {
    echo ""
    echo "📦 Setting up MongoDB..."

    cd "$PROJECT_ROOT/backend"

    # Check if container already exists and is running
    if docker ps | grep -q "auto-trade-mongodb"; then
        info "MongoDB container is already running"
        return
    fi

    if docker ps -a | grep -q "auto-trade-mongodb"; then
        warn "MongoDB container exists but is not running. Starting it..."
        docker-compose up -d mongodb
    else
        info "Starting MongoDB container..."
        docker-compose up -d mongodb
    fi

    # Wait for MongoDB to be ready
    sleep 5
    if docker ps | grep -q "autotrade-mongodb"; then
        info "MongoDB is ready (port 27018)"
    else
        error "MongoDB failed to start"
        exit 1
    fi
}

# Setup backend
setup_backend() {
    echo ""
    echo "🔧 Setting up backend (.NET 9)..."

    cd "$PROJECT_ROOT/backend/src/AutoTrade.WebAPI"

    if [ ! -d "obj" ]; then
        info "Restoring .NET dependencies (first time)..."
        dotnet restore
    else
        info "Backend dependencies already cached"
    fi
}

# Setup frontend
setup_frontend() {
    echo ""
    echo "🎨 Setting up frontend (React + Vite)..."

    cd "$PROJECT_ROOT/frontend"

    if [ ! -d "node_modules" ]; then
        info "Installing npm dependencies (first time)..."
        npm install
    else
        info "Frontend dependencies already cached"
    fi
}

# Main execution
main() {
    check_docker
    setup_mongodb
    setup_backend
    setup_frontend

    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "🎯 Ready to run. Choose one of the following:"
    echo ""
    echo "Option 1: Run in separate terminal windows (recommended)"
    echo "  Terminal 1 (Backend):"
    echo "    cd $PROJECT_ROOT/backend/src/AutoTrade.WebAPI"
    echo "    dotnet run"
    echo ""
    echo "  Terminal 2 (Frontend):"
    echo "    cd $PROJECT_ROOT/frontend"
    echo "    npm run dev"
    echo ""
    echo "Option 2: Run both in background from this script"
    echo "  Run: ./setup-and-run.sh --auto"
    echo ""
    echo "📍 URLs when running:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend API: http://localhost:5265"
    echo "  API Docs: http://localhost:5265/swagger"
    echo ""
}

# Auto-run mode (background processes)
auto_run() {
    echo ""
    echo "🚀 Starting backend and frontend in background..."
    echo ""

    # Start backend in background
    cd "$PROJECT_ROOT/backend/src/AutoTrade.WebAPI"
    info "Starting backend on http://localhost:5265"
    dotnet run > "$PROJECT_ROOT/.backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"

    sleep 2

    # Start frontend in background
    cd "$PROJECT_ROOT/frontend"
    info "Starting frontend on http://localhost:5173"
    npm run dev > "$PROJECT_ROOT/.frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"

    echo ""
    echo "✅ Both services started!"
    echo ""
    echo "📋 Logs:"
    echo "  Backend:  tail -f $PROJECT_ROOT/.backend.log"
    echo "  Frontend: tail -f $PROJECT_ROOT/.frontend.log"
    echo ""
    echo "🛑 To stop services:"
    echo "  kill $BACKEND_PID $FRONTEND_PID"
    echo ""

    # Keep script running so services stay alive
    wait
}

# Parse arguments
if [ "$1" = "--auto" ]; then
    main
    auto_run
else
    main
fi
