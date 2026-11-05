import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import BottomNav from './components/BottomNav';
import Splash from './screens/Splash';
import Home from './screens/Home';
import Detail from './screens/Detail';
import Player from './screens/Player';
import Search from './screens/Search';
import Downloads from './screens/Downloads';
import Me from './screens/Me';
import NovelHub from './screens/NovelHub';
import NovelDetail from './screens/NovelDetail';
import FightZone from './screens/FightZone';
import ShortTV from './screens/ShortTV';
import LiveTV from './screens/LiveTV';
import Browse from './screens/Browse';
import Addons from './screens/Addons';
import SettingsScreen from './screens/Settings';
import HistoryScreen from './screens/History';
import Favorites from './screens/Favorites';

import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/nav.css';
import './styles/screens.css';

function Toast() {
  const { toastMsg } = useStore();
  if (!toastMsg) return null;
  return <div className="toast">{toastMsg}</div>;
}

function ScrollReset() {
  const loc = useLocation();
  useEffect(() => {
    document.querySelectorAll('.scroll').forEach((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
  }, [loc.pathname]);
  return null;
}

function Shell() {
  const loc = useLocation();
  const hideNav =
    loc.pathname.startsWith('/detail') ||
    loc.pathname.startsWith('/player') ||
    loc.pathname.startsWith('/search') ||
    loc.pathname.startsWith('/novels/') ||
    loc.pathname.startsWith('/settings') ||
    loc.pathname.startsWith('/addons') ||
    loc.pathname.startsWith('/history') ||
    loc.pathname.startsWith('/favorites') ||
    loc.pathname.startsWith('/browse') ||
    loc.pathname.startsWith('/shorts') ||
    loc.pathname.startsWith('/live');

  return (
    <>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/novels" element={<NovelHub />} />
        <Route path="/novels/:id" element={<NovelDetail />} />
        <Route path="/fight" element={<FightZone />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/me" element={<Me />} />
        <Route path="/detail/:id" element={<Detail />} />
        <Route path="/player/:id" element={<Player />} />
        <Route path="/search" element={<Search />} />
        <Route path="/shorts" element={<ShortTV />} />
        <Route path="/live" element={<LiveTV />} />
        <Route path="/browse/:kind" element={<Browse />} />
        <Route path="/addons" element={<Addons />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!hideNav && <BottomNav />}
      <Toast />
    </>
  );
}

export default function App() {
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setSplash(false), 1900);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="phone">
      <StoreProvider>
        {splash && <Splash />}
        <HashRouter>
          <Shell />
        </HashRouter>
      </StoreProvider>
    </div>
  );
}
