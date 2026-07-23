import { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { getToken } from "./lib/api";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Modules from "./pages/Modules";
import Operators from "./pages/Operators";
import Requests from "./pages/Requests";
import Schools from "./pages/Schools";

function RequireAuth({ children }: { children: ReactElement }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/operators" element={<Operators />} />
        <Route path="/schools" element={<Schools />} />
        <Route path="/modules" element={<Modules />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
