import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "sonner";

import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./features/auth/AuthProvider";
import { LoginPage } from "./features/auth/LoginPage";
import { PublishPage } from "./features/publish/PublishPage";

const RoadmapPage = lazy(() =>
  import("./features/roadmap/RoadmapPage").then((module) => ({
    default: module.RoadmapPage,
  })),
);

const ChangelogPage = lazy(() =>
  import("./features/changelog/ChangelogPage").then((module) => ({
    default: module.ChangelogPage,
  })),
);

function RouteLoadingState() {
  return (
    <div
      className="grid min-h-64 place-items-center text-sm text-slate-500 dark:text-slate-400"
      aria-busy="true"
    >
      Ansicht wird geladen …
    </div>
  );
}

function lazyRoute(page: ReactNode) {
  return <Suspense fallback={<RouteLoadingState />}>{page}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/roadmap" replace />,
          },
          {
            path: "/roadmap",
            element: lazyRoute(<RoadmapPage />),
          },
          {
            path: "/changelog",
            element: lazyRoute(<ChangelogPage />),
          },
          {
            path: "/publish",
            element: <PublishPage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/roadmap" replace />,
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />

      <Toaster
        position="top-right"
        theme="system"
        richColors
        closeButton
        toastOptions={{ duration: 5000 }}
      />
    </AuthProvider>
  );
}
