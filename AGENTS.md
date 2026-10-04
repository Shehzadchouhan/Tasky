# AGENTS.md - Taskly Guidelines

## Project Overview
Taskly is a full-stack task management application.

## Tech Stack & Conventions
- **Language**: TypeScript throughout (both `client/` and `server/`).
- **Module System**: ES Modules (`"type": "module"`).
- **Frontend (`client/`)**: React + Vite + TypeScript.
- **Backend (`server/`)**: Node.js + Express + Mongoose + dotenv + TypeScript.

## Architecture Guidelines
- **Separation of Concerns**: In `server/src/`, keep `app.ts` (Express app definition, routes, middleware) separate from `server.ts` (database connection and `app.listen()`) to facilitate integration testing (e.g. Supertest).
- **Database Connection**: Graceful startup. The server must start and `/api/health` must respond even when MongoDB is disconnected, reporting `"database": "disconnected"`.
- **CORS**: Always restrict CORS using `process.env.CLIENT_URL` rather than open wildcard origins.
- **Environment Variables**: Maintain `.env.example` templates inside `client/` and `server/` with all required variables. Never commit actual `.env` files.
- **Legacy Files**: All legacy/static files from the previous vanilla JS project reside in `legacy/`. Do not delete them.

## Current Project Phase
- **Phase 1**: Initial structure, configuration, TypeScript setup, `.gitignore`, `.env.example` files, and `GET /api/health`.
- **Phase 2 (Upcoming)**: Data models, authentication, tasks CRUD, and UI features. (Do not implement ahead of time).
