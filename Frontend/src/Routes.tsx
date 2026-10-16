import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LoginPage from "./pages/Auth/Login/Login_page";
import HomePage from "./pages/Home/Home_page";
import DashboardPage from "./pages/Dashboard/Dashboard_page";
import FriendsPage from "./pages/Friends/Friends_page";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "friends",
        element: <FriendsPage />,
      },
    ],
  },
]);

export default router;
