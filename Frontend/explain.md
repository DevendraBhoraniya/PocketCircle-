# Frontend Structure & Working

This document explains the current state of the React frontend.

## Architecture Pattern
The frontend is built with React 19, Vite, Tailwind CSS v4, and React Router v7.

## Current Files and Their Roles

### 1. Application Entry
- **`src/main.tsx`**: The entry point of the React app. It wraps the application in `<GoogleOAuthProvider>` (injecting the Client ID) and `<RouterProvider>` for navigation.
- **`src/App.tsx`**: The root layout component. It contains the global navigation bar (Home, Login links) and an `<Outlet />` where the router renders the active page.
- **`src/Routes.tsx`**: Configures the URL paths (e.g., `/` goes to App, `/login` goes to LoginPage).

### 2. Authentication Flow
- **`src/pages/Auth/Login/Login_page.tsx`**: Handles Google Sign-In.
  - It renders the `<GoogleLogin>` component from `@react-oauth/google`.
  - On success, it calls the backend `/auth/google` API.
  - **Crucial Detail**: The `fetch` calls use `credentials: "include"`. This allows the browser to save the secure `HttpOnly` cookies (Access and Refresh tokens) returned by the backend, and automatically send them on future requests.
  - Contains logic to display the logged-in user and a functional Logout button (hitting `/auth/logout`).

### 3. Styling and Assets
- **`src/index.css`**: Contains the Tailwind CSS v4 setup imports.
- **`tailwind.config.js` / Vite setup**: (Note: Tailwind v4 often uses purely CSS for configuration, hence the lack of a heavy `tailwind.config.js`).
- **`vite.config.ts`**: Configuration for Vite bundler.

## Future Additions
To build out the application, you will create:
- **Pages (`src/pages/`)**: e.g., Dashboard, GroupDetails, AddExpense.
- **Components (`src/components/`)**: Reusable UI elements like Buttons, Modals, Navbar, ExpenseCards.
- **Context/State (`src/context/` or state management)**: To hold the currently logged-in user globally so you don't have to fetch it on every page.
- **API Utilities (`src/api/`)**: Centralized `fetch` or `axios` functions to handle backend requests cleanly (so you don't repeat `credentials: "include"` everywhere).
