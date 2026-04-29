import { useEffect, useState } from 'react';

interface Property {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  basePrice: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string | null;
  houseRules: string | null;
  icalExportToken: string;
}

interface Translation {
  propertyId: string;
  locale: 'pt' | 'en' | 'es';
  tagline: string | null;
  description: string | null;
}

interface Photo {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

interface Amenity {
  id: string;
  key: string;
  icon: string | null;
  label: string;
}

const LOCALES: ('pt' | 'en' | 'es')[] = ['pt', 'en', 'es'];

interface Props {
  propertyId?: string;
}

export default function PropertyEditor({ propertyId }: Props = {}) {
  const [property, setProperty] = useState<Property | null>(null);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'meta' | 'photos' | 'amenities' | 'rules'>('meta');
  const [activeLocale, setActiveLocale] = useState<'pt' | 'en' | 'es'>('pt');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoAlt, setPhotoAlt] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const propUrl = propertyId ? `/api/admin/property?id=${propertyId}` : '/api/admin/property?id=';
      const p = propertyId
        ? await fetch(propUrl).then((r) => r.json())
        : await fetch('/api/admin/property').then((r) => r.json()).then(async (j) => {
            if (j.ok && j.properties && j.properties.length) {
              const id = j.properties[0].id;
              return fetch(`/api/admin/property?id=${id}`).then((r) => r.json());
            }
            return { property: null, translations: [] };
          });

      const photoQs = propertyId ? `?propertyId=${propertyId}` : '';
      const amenityQs = propertyId ? `?propertyId=${propertyId}` : '';
      const [photoRes, amenRes] = await Promise.all([
        fetch(`/api/admin/photos${photoQs}`).then((r) => r.json()).catch(() => ({ photos: [] })),
        fetch(`/api/admin/amenities${amenityQs}`).then((r) => r.json())
      ]);

      if (p.property) {
        setProperty(p.property);
        const trMap: Record<string, Translation> = {};
        for (const tr of p.translations as Translation[]) trMap[tr.locale] = tr;
        for (const l of LOCALES) {
          if (!trMap[l]) trMap[l] = { propertyId: p.property.id, locale: l, tagline: '', description: '' };
        }
        setTranslations(trMap);
      } else {
        setProperty({
          id: '',
          slug: '',
          name: '',
          address: '',
          city: '',
          region: '',
          country: 'PT',
          lat: null,
          lng: null,
          maxGuests: 4,
          bedrooms: 2,
          beds: 2,
          bathrooms: 1,
          basePrice: 100,
          currency: 'EUR',
          checkInTime: '15:00',
          checkOutTime: '11:00',
          cancellationPolicy: '',
          houseRules: '',
          icalExportToken: ''
        });
        const trMap: Record<string, Translation> = {};
        for (const l of LOCALES) trMap[l] = { propertyId: '', locale: l, tagline: '', description: '' };
        setTranslations(trMap);
      }
      setPhotos(photoRes.photos ?? []);
      setAmenities(amenRes.amenities ?? []);
      setSelectedAmenities(new Set(amenRes.selected ?? []));
      setLoading(false);
    })();
  }, [propertyId]);

  if (loading) return <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>A carregar…</p>;
  if (!property) return null;

  const setProp = <K extends keyof Property>(k: K, v: Property[K]) =>
    setProperty((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!property) return;
    setSaving(true);
    setFlash(null);
    try {
      const id = propertyId ?? property.id;
      const url = id ? `/api/admin/property?id=${id}` : '/api/admin/property';
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...property,
          lat: property.lat,
          lng: property.lng,
          translations: Object.values(translations)
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setFlash('Erro: ' + (json.error ?? 'desconhecido'));
      } else {
        setFlash('Guardado.');
        if (json.property) setProperty(json.property);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addPhoto() {
    if (!photoUrl) return;
    const qs = propertyId ? `?propertyId=${propertyId}` : '';
    const res = await fetch(`/api/admin/photos${qs}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: photoUrl, altText: photoAlt || undefined })
    });
    const json = await res.json();
    if (json.ok) {
      setPhotos((ps) => [...ps, json.photo]);
      setPhotoUrl('');
      setPhotoAlt('');
    } else {
      setFlash('Erro a adicionar foto');
    }
  }

  async function removePhoto(id: string) {
    const res = await fetch(`/api/admin/photos?id=${id}`, { method: 'DELETE' });
    if (res.ok) setPhotos((ps) => ps.filter((p) => p.id !== id));
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = photos.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= photos.length) return;
    const arr = [...photos];
    [arr[idx], arr[next]] = [arr[next]!, arr[idx]!];
    setPhotos(arr);
    await fetch('/api/admin/photos', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order: arr.map((p) => p.id) })
    });
  }

  async function saveAmenities() {
    setSaving(true);
    try {
      const qs = propertyId ? `?propertyId=${propertyId}` : '';
      await fetch(`/api/admin/amenities${qs}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amenityIds: Array.from(selectedAmenities) })
      });
      setFlash('Comodidades guardadas.');
    } finally {
      setSaving(false);
    }
  }

  const primaryBtnStyle = { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' };

  return (
    <div className="space-y-6">
      {/* Tab navigation — same pattern as PricingManager */}
      <div className="admin-card flex gap-1 p-1 w-fit">
        {([
          ['meta', 'Metadados'],
          ['photos', 'Fotos'],
          ['amenities', 'Comodidades'],
          ['rules', 'Regras & políticas']
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="btn-action"
            style={tab === k ? primaryBtnStyle : {}}
          >
            {l}
          </button>
        ))}
      </div>

      {flash && (
        <p
          className="text-sm px-3 py-2 border"
          style={{
            borderRadius: '2px',
            background: 'color-mix(in oklab, var(--color-sage-500) 12%, var(--paper))',
            color: 'var(--color-sage-600)',
            borderColor: 'color-mix(in oklab, var(--color-sage-500) 25%, var(--paper))'
          }}
        >
          {flash}
        </p>
      )}

      {tab === 'meta' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="admin-label">Nome</label>
            <input className="admin-input" value={property.name} onChange={(e) => setProp('name', e.target.value)} />
          </div>
          <div>
            <label className="admin-label">País</label>
            <input className="admin-input" value={property.country} onChange={(e) => setProp('country', e.target.value)} maxLength={2} />
          </div>
          <div>
            <label className="admin-label">Cidade</label>
            <input className="admin-input" value={property.city ?? ''} onChange={(e) => setProp('city', e.target.value)} />
          </div>
          <div>
            <label className="admin-label">Região</label>
            <input className="admin-input" value={property.region ?? ''} onChange={(e) => setProp('region', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="admin-label">Morada</label>
            <input className="admin-input" value={property.address ?? ''} onChange={(e) => setProp('address', e.target.value)} />
          </div>
          <div>
            <label className="admin-label">Hóspedes</label>
            <input type="number" className="admin-input" value={property.maxGuests} onChange={(e) => setProp('maxGuests', Number(e.target.value))} />
          </div>
          <div>
            <label className="admin-label">Quartos</label>
            <input type="number" className="admin-input" value={property.bedrooms} onChange={(e) => setProp('bedrooms', Number(e.target.value))} />
          </div>
          <div>
            <label className="admin-label">Camas</label>
            <input type="number" className="admin-input" value={property.beds} onChange={(e) => setProp('beds', Number(e.target.value))} />
          </div>
          <div>
            <label className="admin-label">WCs</label>
            <input type="number" className="admin-input" value={property.bathrooms} onChange={(e) => setProp('bathrooms', Number(e.target.value))} />
          </div>
          <div>
            <label className="admin-label">Preço base / noite</label>
            <input type="number" step="0.01" className="admin-input" value={property.basePrice} onChange={(e) => setProp('basePrice', Number(e.target.value))} />
          </div>
          <div>
            <label className="admin-label">Moeda</label>
            <input className="admin-input" value={property.currency} onChange={(e) => setProp('currency', e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div>
            <label className="admin-label">Check-in</label>
            <input className="admin-input" value={property.checkInTime} onChange={(e) => setProp('checkInTime', e.target.value)} />
          </div>
          <div>
            <label className="admin-label">Check-out</label>
            <input className="admin-input" value={property.checkOutTime} onChange={(e) => setProp('checkOutTime', e.target.value)} />
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-semibold mb-2">Descrições</h3>
            <div className="flex gap-1 mb-3">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLocale(l)}
                  className="btn-action"
                  style={activeLocale === l ? primaryBtnStyle : {}}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <label className="admin-label">Tagline ({activeLocale})</label>
            <input
              className="admin-input"
              value={translations[activeLocale]?.tagline ?? ''}
              onChange={(e) =>
                setTranslations((m) => ({
                  ...m,
                  [activeLocale]: { ...m[activeLocale]!, tagline: e.target.value }
                }))
              }
            />
            <label className="admin-label" style={{ marginTop: '0.75rem' }}>Descrição ({activeLocale})</label>
            <textarea
              className="admin-textarea"
              rows={6}
              value={translations[activeLocale]?.description ?? ''}
              onChange={(e) =>
                setTranslations((m) => ({
                  ...m,
                  [activeLocale]: { ...m[activeLocale]!, description: e.target.value }
                }))
              }
            />
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="admin-label">URL da foto</label>
              <input className="admin-input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex-1">
              <label className="admin-label">Texto alternativo</label>
              <input className="admin-input" value={photoAlt} onChange={(e) => setPhotoAlt(e.target.value)} />
            </div>
            <button onClick={addPhoto} className="btn-action" style={primaryBtnStyle}>Adicionar</button>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <li key={p.id} className="admin-card overflow-hidden">
                <img src={p.url} alt={p.altText ?? ''} className="w-full h-32 object-cover" />
                <div className="p-2 text-xs flex items-center justify-between" style={{ color: 'var(--ink-muted)' }}>
                  <span>#{i + 1}</span>
                  <div className="flex gap-1">
                    <button onClick={() => move(p.id, -1)} className="btn-action">↑</button>
                    <button onClick={() => move(p.id, 1)} className="btn-action">↓</button>
                    <button onClick={() => removePhoto(p.id)} className="btn-action btn-action-danger">✕</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'amenities' && (
        <div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {amenities.map((a) => {
              const active = selectedAmenities.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    onClick={() =>
                      setSelectedAmenities((s) => {
                        const next = new Set(s);
                        if (next.has(a.id)) next.delete(a.id);
                        else next.add(a.id);
                        return next;
                      })
                    }
                    className="btn-action w-full text-left"
                    style={active ? primaryBtnStyle : {}}
                  >
                    {a.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={saveAmenities}
            disabled={saving}
            className="btn-action mt-4"
            style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? '…' : 'Guardar comodidades'}
          </button>
        </div>
      )}

      {tab !== 'amenities' && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--rule)' }}>
          <button
            onClick={save}
            disabled={saving}
            className="btn-action"
            style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
