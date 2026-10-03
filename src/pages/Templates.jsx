import React, { useState } from 'react';
import AppLayout, { PageHeader } from '../components/layout/AppLayout';
import TemplateGallery from '../components/templates/TemplateGallery';
import { SearchInput } from '../components/common/Input';
import { usePrefs } from '../context/PrefsContext';
import { useRouter } from '../lib/router';
import { CATEGORIES } from '../templates/data';

export default function Templates() {
  const { query, navigate } = useRouter();
  const { prefs, toggleFavoriteTemplate } = usePrefs();
  const [q, setQ] = useState(query.get('q') || '');
  const initialCat = query.get('category');
  const [category, setCategory] = useState(CATEGORIES.some((c) => c.id === initialCat) ? initialCat : 'all');

  return (
    <AppLayout>
      <PageHeader title="Templates" subtitle="Choose from our collection of aesthetic and trendy templates.">
        <SearchInput
          label="Search templates"
          placeholder="Search templates…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="header-search"
        />
      </PageHeader>
      <TemplateGallery
        query={q}
        category={category}
        onCategory={setCategory}
        favorites={prefs.favoriteTemplates}
        onToggleFavorite={toggleFavoriteTemplate}
        onUse={(id) => navigate(`/booth?template=${id}`)}
      />
    </AppLayout>
  );
}
