import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Layout from './components/Layout';
import NameModal from './components/NameModal';
import KeyboardHelp from './components/KeyboardHelp';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import WorkflowDetail from './pages/WorkflowDetail';
import RunViewer from './pages/RunViewer';
import Results from './pages/Results';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Guide from './pages/Guide';
import NotFound from './pages/NotFound';

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || '');
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  const queryClient = useQueryClient();

  const handleNameSubmit = (name: string, id: string) => {
    localStorage.setItem('userName', name);
    localStorage.setItem('userId', id);
    setUserName(name);
    setUserId(id);
    queryClient.clear();
  };

  const handleLogout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setUserName('');
    setUserId('');
    queryClient.clear();
  };

  return (
    <>
      {(!userName || !userId) && <NameModal onSubmit={handleNameSubmit} />}
      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <Layout userName={userName} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/workflows/new" element={<WorkflowBuilder />} />
          <Route path="/workflows/:id" element={<WorkflowDetail />} />
          <Route path="/workflows/:id/edit" element={<WorkflowBuilder />} />
          <Route path="/runs/:id" element={<RunViewer />} />
          <Route path="/results" element={<Results />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </>
  );
}
