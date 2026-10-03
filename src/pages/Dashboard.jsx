import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import WelcomeCard from '../components/dashboard/WelcomeCard';
import QuickActions from '../components/dashboard/QuickActions';
import RecentMemories from '../components/dashboard/RecentMemories';
import PhotoViewer from '../components/photos/PhotoViewer';
import useStripActions from '../components/photos/useStripActions';
import { SearchInput } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { useStrips } from '../context/StripsContext';
import { useRouter } from '../lib/router';
import { firstName, greeting } from '../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { strips, loading } = useStrips();
  const { navigate } = useRouter();
  const actions = useStripActions();
  const [viewId, setViewId] = useState(null);
  const [q, setQ] = useState('');

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {firstName(user.name)}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="page-subtitle">Ready to make some memories?</p>
        </div>
        <form
          className="page-header-actions"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/templates${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
          }}
        >
          <SearchInput
            label="Search templates"
            placeholder="Search templates…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="header-search"
          />
        </form>
      </div>

      <div className="dash-stack">
        <WelcomeCard recent={strips} />
        <QuickActions />
        <RecentMemories strips={strips} loading={loading} actions={actions} onOpen={(s) => setViewId(s.id)} />
      </div>

      <PhotoViewer strip={strips.find((s) => s.id === viewId)} onClose={() => setViewId(null)} actions={actions} />
    </AppLayout>
  );
}
