import React from 'react';
import AppLayout, { PageHeader } from '../components/layout/AppLayout';
import TemplateGallery from '../components/templates/TemplateGallery';
import Button from '../components/common/Button';
import { EmptyState } from '../components/common/misc';
import MyPhotos from './MyPhotos';
import { usePrefs } from '../context/PrefsContext';
import { useRouter } from '../lib/router';
import { TEMPLATES } from '../templates/data';

export default function Favorites() {
  const { prefs, toggleFavoriteTemplate } = usePrefs();
  const { navigate } = useRouter();
  const favTemplates = TEMPLATES.filter((t) => prefs.favoriteTemplates.includes(t.id));

  return (
    <AppLayout>
      <PageHeader title="Favorites" subtitle="The strips and templates you love most." />

      <section className="fav-section" aria-labelledby="fav-strips">
        <div className="section-title">
          <h2 id="fav-strips">Favorite Strips</h2>
        </div>
        <MyPhotos favoritesOnly embedded />
      </section>

      <section className="fav-section" aria-labelledby="fav-templates">
        <div className="section-title">
          <h2 id="fav-templates">Favorite Templates</h2>
        </div>
        {favTemplates.length === 0 ? (
          <EmptyState
            icon="templates"
            title="No favorite templates yet"
            action={
              <Button to="/templates" variant="outline" size="sm">
                Browse templates
              </Button>
            }
          >
            Tap the heart on a template to save it here.
          </EmptyState>
        ) : (
          <TemplateGallery
            category="all"
            only={favTemplates}
            favorites={prefs.favoriteTemplates}
            onToggleFavorite={toggleFavoriteTemplate}
            onUse={(id) => navigate(`/booth?template=${id}`)}
          />
        )}
      </section>
    </AppLayout>
  );
}
