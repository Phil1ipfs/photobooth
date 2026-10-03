import React from 'react';
import Icon from '../common/Icon';
import { Link } from '../../lib/router';
import { TEMPLATES } from '../../templates/data';

const ACTIONS = [
  { to: '/booth', icon: 'camera', title: 'Take a Photo', text: 'Start a new session' },
  { to: '/templates', icon: 'templates', title: 'Choose Template', text: `Browse ${TEMPLATES.length} aesthetic templates` },
  { to: '/photos', icon: 'image', title: 'View My Photos', text: 'Your saved memories' },
];

export default function QuickActions() {
  return (
    <section aria-labelledby="qa-title">
      <div className="section-title">
        <h2 id="qa-title">Quick Actions</h2>
      </div>
      <div className="quick-actions">
        {ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="quick-action card card-hover">
            <span className="quick-action-icon">
              <Icon name={a.icon} size={20} />
            </span>
            <span className="quick-action-text">
              <strong>{a.title}</strong>
              <small>{a.text}</small>
            </span>
            <Icon name="arrow-right" size={16} className="quick-action-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}
