import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Save,
  Zap,
  Clock,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Bell,
  Monitor,
  Shield,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { getAIStatus, enterUser } from '../services/api';

interface ExecutionSettings {
  stepTimeout: number;
  maxRetries: number;
  failureMode: 'stop' | 'skip' | 'ask';
  screenshotOnStep: boolean;
  parallelExecution: boolean;
}

const DEFAULT_SETTINGS: ExecutionSettings = {
  stepTimeout: 30,
  maxRetries: 2,
  failureMode: 'ask',
  screenshotOnStep: true,
  parallelExecution: false,
};

export default function Settings() {
  const [name, setName] = useState('');
  const [execSettings, setExecSettings] = useState<ExecutionSettings>(DEFAULT_SETTINGS);
  const [notifications, setNotifications] = useState({
    onRunComplete: true,
    onRunFailed: true,
    onScheduledRun: false,
  });

  const { data: aiStatus, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ['ai-status'],
    queryFn: getAIStatus,
    refetchInterval: 30000,
  });

  useEffect(() => {
    setName(localStorage.getItem('userName') || '');
    const saved = localStorage.getItem('execSettings');
    if (saved) {
      try { setExecSettings(JSON.parse(saved)); } catch { /* use defaults */ }
    }
    const savedNotif = localStorage.getItem('notifSettings');
    if (savedNotif) {
      try { setNotifications(JSON.parse(savedNotif)); } catch { /* use defaults */ }
    }
  }, []);

  const [profileLoading, setProfileLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setProfileLoading(true);
    try {
      const res = await enterUser(name.trim());
      localStorage.setItem('userName', res.name);
      localStorage.setItem('userId', res.id);
      toast.success('Profile updated! Reload to see your data.');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveExecution = () => {
    localStorage.setItem('execSettings', JSON.stringify(execSettings));
    toast.success('Execution settings saved');
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('notifSettings', JSON.stringify(notifications));
    toast.success('Notification preferences saved');
  };

  const handleClearData = () => {
    if (!confirm('This will clear all local preferences. Continue?')) return;
    localStorage.removeItem('execSettings');
    localStorage.removeItem('notifSettings');
    setExecSettings(DEFAULT_SETTINGS);
    setNotifications({ onRunComplete: true, onRunFailed: true, onScheduledRun: false });
    toast.success('Local data cleared');
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-gray-500 mb-6">Manage your profile, execution preferences, and notifications.</p>

      {/* Profile */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Profile</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={handleSaveProfile} disabled={profileLoading}>
            {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {profileLoading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Execution Settings */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold">Execution Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Step Timeout (seconds)
              </label>
              <input
                type="number"
                className="input"
                value={execSettings.stepTimeout}
                onChange={(e) => setExecSettings({ ...execSettings, stepTimeout: +e.target.value })}
                min={5}
                max={120}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                Max Retries
              </label>
              <input
                type="number"
                className="input"
                value={execSettings.maxRetries}
                onChange={(e) => setExecSettings({ ...execSettings, maxRetries: +e.target.value })}
                min={0}
                max={5}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              On Step Failure
            </label>
            <div className="flex gap-2">
              {(['ask', 'skip', 'stop'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExecSettings({ ...execSettings, failureMode: mode })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors border ${
                    execSettings.failureMode === mode
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {mode === 'ask' ? 'Ask Me' : mode === 'skip' ? 'Skip Step' : 'Stop Run'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Capture screenshots</p>
              <p className="text-xs text-gray-400">Take a screenshot after each step</p>
            </div>
            <button
              onClick={() => setExecSettings({ ...execSettings, screenshotOnStep: !execSettings.screenshotOnStep })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                execSettings.screenshotOnStep ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  execSettings.screenshotOnStep ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Parallel execution</p>
              <p className="text-xs text-gray-400">Run independent steps concurrently</p>
            </div>
            <button
              onClick={() => setExecSettings({ ...execSettings, parallelExecution: !execSettings.parallelExecution })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                execSettings.parallelExecution ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  execSettings.parallelExecution ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={handleSaveExecution}>
            <Save className="w-4 h-4" /> Save Execution Settings
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'onRunComplete' as const, label: 'Run completed', desc: 'Notify when a workflow run finishes successfully' },
            { key: 'onRunFailed' as const, label: 'Run failed', desc: 'Notify when a workflow run encounters an error' },
            { key: 'onScheduledRun' as const, label: 'Scheduled run started', desc: 'Notify when a scheduled workflow begins' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [key]: !notifications[key] })}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  notifications[key] ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    notifications[key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
          <button className="btn-primary flex items-center gap-2 mt-2" onClick={handleSaveNotifications}>
            <Save className="w-4 h-4" /> Save Notifications
          </button>
        </div>
      </div>

      {/* AI Models */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold">AI Models</h2>
          </div>
          <button
            onClick={() => refetchAI()}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
        {aiStatus && (
          <div className={`rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2 ${
            aiStatus.connected && !aiStatus.throttled
              ? 'bg-green-50 text-green-700'
              : aiStatus.throttled
              ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              aiStatus.connected && !aiStatus.throttled
                ? 'bg-green-500'
                : aiStatus.throttled
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`} />
            {aiStatus.message}
            <span className="text-xs opacity-70 ml-auto">{aiStatus.region}</span>
          </div>
        )}
        <div className="space-y-0">
          <div className="flex justify-between py-3 border-b border-gray-100">
            <div>
              <span className="text-sm font-medium">Amazon Nova Lite</span>
              <p className="text-xs text-gray-400">Workflow planning & data extraction</p>
            </div>
            <span className={`text-xs rounded-full px-2.5 py-1 h-fit ${
              aiStatus?.connected && !aiStatus?.throttled
                ? 'bg-green-100 text-green-700'
                : aiStatus?.throttled
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {aiStatus?.connected ? (aiStatus.throttled ? 'Rate Limited' : 'Connected') : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between py-3 border-b border-gray-100">
            <div>
              <span className="text-sm font-medium">Amazon Nova Pro</span>
              <p className="text-xs text-gray-400">Screenshot analysis and visual understanding</p>
            </div>
            <span className={`text-xs rounded-full px-2.5 py-1 h-fit ${
              aiStatus?.connected && !aiStatus?.throttled
                ? 'bg-green-100 text-green-700'
                : aiStatus?.throttled
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {aiStatus?.connected ? (aiStatus.throttled ? 'Rate Limited' : 'Connected') : 'Offline'}
            </span>
          </div>
          <div className="flex justify-between py-3">
            <div>
              <span className="text-sm font-medium">Nova Act SDK</span>
              <p className="text-xs text-gray-400">Headless browser automation engine</p>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2.5 py-1 h-fit">Simulation</span>
          </div>
        </div>
      </div>

      {/* About + Danger Zone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-4">About</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">FlowPilot v1.0.0</p>
              <p className="text-xs text-gray-400">AI Workflow Engine</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Built for the Amazon Nova AI Hackathon. Describe business workflows in plain English
            and let AI do the rest.
          </p>
        </div>

        <div className="card p-6 border-red-100">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-red-700">Danger Zone</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Reset all local preferences to their defaults.
          </p>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
            onClick={handleClearData}
          >
            <Trash2 className="w-4 h-4" /> Clear Local Data
          </button>
        </div>
      </div>
    </div>
  );
}
