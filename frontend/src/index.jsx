import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { UICacheProvider } from "./contexts/UICacheContext.jsx";

// NOTE: Manual service worker registration & update modal removed.
// We now rely exclusively on the registerSW flow inside App.jsx plus the
// dedicated <PWAUpdatePrompt /> component for user-controlled updates.
// This avoids unintended auto updates after a dismiss action.

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Router>
    <AuthProvider>
      <ThemeProvider>
        <UICacheProvider>
          <App />
        </UICacheProvider>
      </ThemeProvider>
    </AuthProvider>
  </Router>,
);
