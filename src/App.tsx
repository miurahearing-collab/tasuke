import React, { useState } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Archive } from './components/Archive';
import { Settings } from './components/Settings';
import { TeamMeeting } from './components/TeamMeeting';
import { Meeting } from './components/Meeting';
import { Home } from './components/Home';
import { Evaluation } from './components/Evaluation';

const AppContent = () => {
  const { currentUser } = useAppContext();
  const [currentScreen, setCurrentScreen] = useState<'home' | 'dashboard' | 'archive' | 'settings' | 'meeting' | 'reservation' | 'evaluation'>('home');

  if (!currentUser) {
    return <Login />;
  }

  return (
    <Layout currentScreen={currentScreen} setCurrentScreen={setCurrentScreen}>
      {currentScreen === 'home' && <Home setCurrentScreen={setCurrentScreen} />}
      {currentScreen === 'dashboard' && <Dashboard />}
      {currentScreen === 'archive' && <Archive />}
      {currentScreen === 'settings' && <Settings />}
      {currentScreen === 'meeting' && <TeamMeeting />}
      {currentScreen === 'reservation' && <Meeting />}
      {currentScreen === 'evaluation' && <Evaluation />}
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
