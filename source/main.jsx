import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "./source/Home.jsx";   // <-- fixed
import Song from "./source/Song.jsx";   // <-- fixed
import "./styles.css";

const router = createHashRouter([
  { path: "/", element: <Home /> },
  { path: "/song/:id", element: <Song /> }
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
