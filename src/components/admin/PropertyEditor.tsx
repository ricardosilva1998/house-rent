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
      // Fall back to default if no id provided
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

  if (loading) return <p className="text-sm text-stone-500">A carregar…</p>;
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

  const input = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';
  const label = 'block text-sm font-medium text-stone-700 mb-1';

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-stone-200">
        {([
          ['meta', 'Metadados'],
          ['photos', 'Fotos'],
          ['amenities', 'Comodidades'],
          ['rules', 'Regras & políticas']
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === k ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}
          >
            {l}
          </button>
        ))}
      </nav>

      {flash && (
        <p className="text-sm rounded-md bg-emerald-50 text-emerald-800 px-3 py-2 border border-emerald-200">
          {flash}
        </p>
      )}

      {tab === 'meta' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Nome</label>
            <input className={input} value={property.name} onChange={(e) => setProp('name', e.target.value)} />
          </div>
          <div>
            <label className={label}>País</label>
            <input className={input} value={property.country} onChange={(e) => setProp('country', e.target.value)} maxLength={2} />
          </div>
          <div>
            <label className={label}>Cidade</label>
            <input className={input} value={property.city ?? ''} onChange={(e) => setProp('city', e.target.value)} />
          </div>
          <div>
            <label className={label}>Região</label>
            <input className={input} value={property.region ?? ''} onChange={(e) => setProp('region', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Morada</label>
            <input className={input} value={property.address ?? ''} onChange={(e) => setProp('address', e.target.value)} />
          </div>
          <div>
            <label className={label}>Hóspedes</label>
            <input type="number" className={input} value={property.maxGuests} onChange={(e) => setProp('maxGuests', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Quartos</label>
            <input type="number" className={input} value={property.bedrooms} onChange={(e) => setProp('bedrooms', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Camas</label>
            <input type="number" className={input} value={property.beds} onChange={(e) => setProp('beds', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>WCs</label>
            <input type="number" className={input} value={property.bathrooms} onChange={(e) => setProp('bathrooms', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Preço base / noite</label>
            <input type="number" step="0.01" className={input} value={property.basePrice} onChange={(e) => setProp('basePrice', Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Moeda</label>
            <input className={input} value={property.currency} onChange={(e) => setProp('currency', e.target.value.toUpperCase())} maxLength={3} />
          </div>
          <div>
            <label className={label}>Check-in</label>
            <input className={input} value={property.checkInTime} onChange={(e) => setProp('checkInTime', e.target.value)} />
          </div>
          <div>
            <label className={label}>Check-out</label>
            <input className={input} value={property.checkOutTime} onChange={(e) => setProp('checkOutTime', e.target.value)} />
          </div>

          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-semibold mb-2">Descrições</h3>
            <div className="flex gap-1 mb-3">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLocale(l)}
                  className={`px-3 py-1 text-xs rounded ${activeLocale === l ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-700'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <label className={label}>Tagline ({activeLocale})</label>
            <input
              className={input}
              value={translations[activeLocale]?.tagline ?? ''}
              onChange={(e) =>
                setTranslations((m) => ({
                  ...m,
                  [activeLocale]: { ...m[activeLocale]!, tagline: e.target.value }
                }))
              }
            />
            <label className={`${label} mt-3`}>Descrição ({activeLocale})</label>
            <textarea
              className={input}
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
              <label className={label}>URL da foto</label>
              <input className={input} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex-1">
              <label className={label}>Texto alternativo</label>
              <input className={input} value={photoAlt} onChange={(e) => setPhotoAlt(e.target.value)} />
            </div>
            <button onClick={addPhoto} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">Adicionar</button>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <li key={p.id} className="rounded-md border border-stone-200 bg-white overflow-hidden">
                <img src={p.url} alt={p.altText ?? ''} className="w-full h-32 object-cover" />
                <div className="p-2 text-xs text-stone-600 flex items-center justify-between">
                  <span>#{i + 1}</span>
                  <div className="flex gap-1">
                    <button onClick={() => move(p.id, -1)} className="px-2">↑</button>
                    <button onClick={() => move(p.id, 1)} className="px-2">↓</button>
                    <button onClick={() => removePhoto(p.id)} className="px-2 text-red-600">✕</button>
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
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm ${active ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 hover:bg-stone-50'}`}
                  >
                    {a.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={saveAmenities} disabled={saving} className="mt-4 rounded-md bg-stone-900 text-white px-4 py-2 text-sm">
            {saving ? '…' : 'Guardar comodidades'}
          </button>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <div>
            <label className={label}>Regras da casa</label>
            <textarea className={input} rows={6} value={property.houseRules ?? ''} onChange={(e) => setProp('houseRules', e.target.value)} />
          </div>
          <div>
            <label className={label}>Política de cancelamento</label>
            <textarea className={input} rows={4} value={property.cancellationPolicy ?? ''} onChange={(e) => setProp('cancellationPolicy', e.target.value)} />
          </div>
        </div>
      )}

      {tab !== 'amenities' && (
        <div className="pt-4 border-t border-stone-200">
          <button onClick={save} disabled={saving} className="rounded-md bg-stone-900 text-white px-5 py-2 text-sm font-medium">
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}
