/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from "react";
import { createBrowserRouter, useRouteError, isRouteErrorResponse } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFoundPage from "./pages/NotFound/NotFoundPage";
import {
  DashboardSkeleton,
  GroupListSkeleton,
  GroupDetailSkeleton,
  FriendsSkeleton,
  LoginSkeleton,
  HomeSkeleton,
} from "./components/skeletons";

function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-xl border border-sand bg-paper-white p-8 shadow-xs space-y-4">
        <h2 className="text-xl font-semibold text-ink-black">Something went wrong</h2>
        <p className="text-xs text-steel">
          {error instanceof Error ? error.message : "An unexpected error occurred while loading this page."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="pc-btn pc-btn-primary text-xs px-4 py-2"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

const HomePage = lazy(() => import("./pages/Home/HomePage"));
const LoginPage = lazy(() => import("./pages/Auth/Login/LoginPage"));
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const FriendsPage = lazy(() => import("./pages/Friends/FriendsPage"));
const GroupsPage = lazy(() => import("./pages/Groups/GroupsPage"));
const GroupDetailPage = lazy(() => import("./pages/Groups/GroupDetailPage"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<HomeSkeleton />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: "login",
        element: (
          <Suspense fallback={<LoginSkeleton />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute fallback={<DashboardSkeleton />}>
            <Suspense fallback={<DashboardSkeleton />}>
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "friends",
        element: (
          <ProtectedRoute fallback={<FriendsSkeleton />}>
            <Suspense fallback={<FriendsSkeleton />}>
              <FriendsPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "groups",
        element: (
          <ProtectedRoute fallback={<GroupListSkeleton />}>
            <Suspense fallback={<GroupListSkeleton />}>
              <GroupsPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "groups/:groupId",
        element: (
          <ProtectedRoute fallback={<GroupDetailSkeleton />}>
            <Suspense fallback={<GroupDetailSkeleton />}>
              <GroupDetailPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

export default router;
