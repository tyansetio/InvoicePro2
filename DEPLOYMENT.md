# Deployment Guide (VPS)

This guide explains how to deploy the InvoicePro2 application to a VPS using Docker and Docker Compose.

## Prerequisites

- A VPS running Linux (Ubuntu 22.04+ recommended)
- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on the VPS.

## Step-by-Step Deployment

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd InvoicePro2
```

### 2. Configure Environment Variables
Copy the example environment file and update the values:
```bash
cp .env.example .env
nano .env
```
> [!IMPORTANT]
> Change `SESSION_SECRET` to a long, random, and secure string.

### 3. Build and Start the Containers
```bash
docker compose up -d --build
```
This command will:
- Build the optimized production image (multi-stage).
- Start a PostgreSQL 16 database container.
- Start the application container and connect it to the database.

### 4. Setup Database Schema (Initial Setup)
Push the application schema to the fresh database:
```bash
docker compose exec app npm run db:push
```

### 5. Access the Application
The application will be available at `http://your-vps-ip:5000`.

## Common Commands

### Accessing Logs
```bash
docker compose logs -f app
```

### Restarting
```bash
docker compose restart app
```

### Stopping
```bash
docker compose down
```

### Updating
```bash
git pull
docker compose up -d --build
```
