import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Nav } from "./components/Nav";
import { usePlayer } from "./lib/player";
import Home from "./pages/Home";
import PlayMaps from "./pages/PlayMaps";
import CreateMap from "./pages/CreateMap";
import Game from "./pages/Game";
import Loadout from "./pages/Loadout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Profile from "./pages/Profile";

export default function App() {
  const init = usePlayer((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-full flex flex-col">
      <Routes>
        {/* Full-screen routes render their own chrome. */}
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateMap />} />
        <Route path="/edit/:id" element={<CreateMap />} />
        <Route path="/game/:id" element={<Game />} />
        <Route
          path="*"
          element={
            <>
              <Nav />
              <div className="flex-1">
                <Routes>
                  <Route path="/play" element={<PlayMaps />} />
                  <Route path="/loadout" element={<Loadout />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </>
          }
        />
      </Routes>
    </div>
  );
}
