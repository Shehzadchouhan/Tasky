# Taskly frontend

The React and TypeScript frontend is built with Vite. For project features, full-stack setup, environment configuration, and development commands, see the [project README](../README.md).

To run only the frontend during development:

```sh
npm run dev
```

The Vite development server proxies `/api` requests to the backend at `http://localhost:5000`.

Production builds can be installed as a home-screen app. A service worker caches the app shell and static assets for faster repeat launches; API requests are never cached and still require a network connection.
