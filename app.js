const { useEffect, useMemo, useState } = React;

const GROUPS = [
    { id: 'cantantes', label: 'Cantantes', singular: 'Cantante', emoji: '🎤', color: '#2563eb', button: 'from-blue-400 via-blue-600 to-blue-900', border: 'border-blue-400', glow: 'shadow-blue-950/70' },
    { id: 'actrices', label: 'Actrices', singular: 'Actriz', emoji: '🎬', color: '#16a34a', button: 'from-green-400 via-green-600 to-green-900', border: 'border-green-400', glow: 'shadow-green-950/70' },
    { id: 'nsfw', label: 'NSFW', singular: 'NSFW', emoji: '🔥', color: '#dc2626', button: 'from-red-400 via-red-600 to-red-950', border: 'border-red-400', glow: 'shadow-red-950/70' },
    { id: 'otros', label: 'Otros', singular: 'Otro', emoji: '⭐', color: '#ca8a04', button: 'from-yellow-300 via-yellow-500 to-yellow-800', border: 'border-yellow-300', glow: 'shadow-yellow-950/70' },
];

const EMPTY_FORM = {
    name: '', birthDate: '', country: '', city: '', height: '', photo: '', group: 'cantantes'
};

const STORAGE_KEY = 'supereliteg2-state-v1';
const DATA_URL = 'characters.json';
const CHARACTERS_API_URL = '/api/characters';
const fallbackPhoto = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#334155"/><stop offset="1" stop-color="#020617"/></linearGradient></defs>
        <rect width="500" height="500" fill="url(#g)"/><circle cx="250" cy="180" r="82" fill="#94a3b8"/><path d="M95 440c22-96 84-148 155-148s133 52 155 148" fill="#64748b"/>
    </svg>
`);

const todayISO = () => new Date().toISOString().slice(0, 10);
const getGroup = (id) => GROUPS.find(group => group.id === id) || GROUPS[0];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function calculateAge(dateString) {
    if (!dateString) return '';
    const birth = new Date(`${dateString}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDelta = today.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
    return Number.isFinite(age) && age >= 0 ? age : '';
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function normalizeCharacter(character) {
    return {
        ...EMPTY_FORM,
        ...character,
        group: character.group === 'actriz' ? 'actrices' : character.group,
        id: character.id || uid(),
    };
}

function mergeCharacters(jsonCharacters, storedCharacters) {
    const merged = new Map();
    jsonCharacters.map(normalizeCharacter).forEach(character => merged.set(character.id, character));
    storedCharacters.map(normalizeCharacter).forEach(character => merged.set(character.id, character));
    return Array.from(merged.values());
}

async function loadCharactersFromJson() {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar ${DATA_URL}: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.characters) ? data.characters : [];
}

async function saveCharactersToJson(characters) {
    const response = await fetch(CHARACTERS_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `No se pudo actualizar ${DATA_URL}: ${response.status}`);
    }

    return response.json();
}

function App() {
    const [view, setView] = useState({ page: 'characters' });
    const [characters, setCharacters] = useState([]);
    const [media, setMedia] = useState([]);
    const [characterModal, setCharacterModal] = useState(null);
    const [mediaModal, setMediaModal] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [persistenceStatus, setPersistenceStatus] = useState('');

    useEffect(() => {
        let isMounted = true;

        async function loadInitialState() {
            let jsonCharacters = [];
            let storedCharacters = [];
            let storedMedia = [];

            try {
                jsonCharacters = await loadCharactersFromJson();
            } catch (error) {
                console.error(error);
                setLoadError('No se pudo leer characters.json. Abre la página desde un servidor local para permitir la carga del JSON.');
            }

            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    storedCharacters = parsed.characters || [];
                    storedMedia = parsed.media || [];
                }
            } catch (error) {
                console.error('No se pudo leer localStorage:', error);
            }

            if (!isMounted) return;
            setCharacters(mergeCharacters(jsonCharacters, storedCharacters));
            setMedia(storedMedia);
            setIsLoaded(true);
        }

        loadInitialState();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ media }));
    }, [media, isLoaded]);

    const selectedGroup = view.groupId ? getGroup(view.groupId) : null;
    const selectedCharacter = view.characterId ? characters.find(character => character.id === view.characterId) : null;
    const groupCharacters = selectedGroup ? characters.filter(character => character.group === selectedGroup.id) : [];
    const selectedCharacterMedia = selectedCharacter ? media.filter(item => item.characterId === selectedCharacter.id) : [];
    const mediaWithCharacters = useMemo(() => media.map(item => ({ ...item, character: characters.find(character => character.id === item.characterId) })).filter(item => item.character), [media, characters]);

    const navigate = (nextView) => setView(nextView);

    const persistCharacters = async (nextCharacters) => {
        setPersistenceStatus('Guardando cambios en characters.json...');
        try {
            await saveCharactersToJson(nextCharacters);
            setPersistenceStatus('✅ characters.json actualizado automáticamente.');
        } catch (error) {
            console.error(error);
            setPersistenceStatus('⚠️ Cambio guardado en pantalla, pero no se pudo escribir characters.json. Inicia la app con `node server.js`.');
        }
    };

    const saveCharacter = async (payload) => {
        let nextCharacters;
        if (payload.id) {
            nextCharacters = characters.map(character => character.id === payload.id ? { ...character, ...payload } : character);
        } else {
            nextCharacters = [{ ...payload, id: uid(), createdAt: new Date().toISOString() }, ...characters];
        }

        setCharacters(nextCharacters);
        setCharacterModal(null);
        setView({ page: 'group', groupId: payload.group });
        await persistCharacters(nextCharacters);
    };

    const deleteCharacter = async (characterId) => {
        const character = characters.find(item => item.id === characterId);
        if (!character || !confirm(`¿Eliminar a ${character.name} y toda su multimedia?`)) return;
        const nextCharacters = characters.filter(item => item.id !== characterId);

        setCharacters(nextCharacters);
        setMedia(prev => prev.filter(item => item.characterId !== characterId));
        setView({ page: 'group', groupId: character.group });
        await persistCharacters(nextCharacters);
    };

    const saveMedia = (payload) => {
        setMedia(prev => [{ ...payload, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
        setMediaModal(null);
    };

    const openEditCharacter = (character) => setCharacterModal({ mode: 'edit', character });
    const openNewCharacter = (groupId = 'cantantes') => setCharacterModal({ mode: 'new', character: { ...EMPTY_FORM, group: groupId } });

    return (
        <div className="min-h-screen">
            <TopNav currentPage={view.page} onNavigate={navigate} />
            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                {loadError && <div className="metal-panel metal-shadow mb-5 rounded-2xl border border-yellow-400/50 p-4 font-bold text-yellow-100">⚠️ {loadError}</div>}
                {persistenceStatus && <div className="metal-panel metal-shadow mb-5 rounded-2xl border border-cyan-400/50 p-4 font-bold text-cyan-100">{persistenceStatus}</div>}
                {view.page === 'characters' && <GroupsScreen onOpenGroup={(groupId) => navigate({ page: 'group', groupId })} />}
                {view.page === 'gallery' && <GeneralGallery items={mediaWithCharacters} />}
                {view.page === 'group' && <GroupScreen group={selectedGroup} characters={groupCharacters} onBack={() => navigate({ page: 'characters' })} onAdd={() => openNewCharacter(selectedGroup.id)} onOpen={(id) => navigate({ page: 'profile', characterId: id })} />}
                {view.page === 'profile' && selectedCharacter && <ProfileScreen character={selectedCharacter} mediaCount={selectedCharacterMedia.length} onBack={() => navigate({ page: 'group', groupId: selectedCharacter.group })} onGallery={() => navigate({ page: 'characterGallery', characterId: selectedCharacter.id })} onEdit={() => openEditCharacter(selectedCharacter)} onDelete={() => deleteCharacter(selectedCharacter.id)} />}
                {view.page === 'characterGallery' && selectedCharacter && <CharacterGallery character={selectedCharacter} items={selectedCharacterMedia} onBack={() => navigate({ page: 'profile', characterId: selectedCharacter.id })} onAdd={() => setMediaModal({ character: selectedCharacter })} />}
            </main>
            {characterModal && <CharacterFormModal initial={characterModal.character} onClose={() => setCharacterModal(null)} onSave={saveCharacter} />}
            {mediaModal && <MediaFormModal character={mediaModal.character} onClose={() => setMediaModal(null)} onSave={saveMedia} />}
        </div>
    );
}

function TopNav({ currentPage, onNavigate }) {
    return (
        <header className="metal-panel sticky top-0 z-30 border-b border-cyan-200/20 bg-zinc-950/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                <button onClick={() => onNavigate({ page: 'characters' })} className="text-left">
                    <p className="text-xs font-bold uppercase tracking-[.35em] text-cyan-200">Cabecera oficial</p>
                    <h1 className="cartoon-title text-4xl leading-none sm:text-5xl">SuperEliteG2</h1>
                </button>
                <nav className="metal-card metal-shadow grid grid-cols-2 gap-2 rounded-2xl border border-white/20 p-1">
                    <button onClick={() => onNavigate({ page: 'characters' })} className={`metal-button rounded-xl px-5 py-3 font-black transition ${currentPage !== 'gallery' ? 'bg-gradient-to-br from-cyan-200 via-white to-slate-300 text-zinc-950' : 'bg-gradient-to-br from-slate-700 via-slate-900 to-black text-white hover:bg-white/10'}`}>👥 Personajes</button>
                    <button onClick={() => onNavigate({ page: 'gallery' })} className={`metal-button rounded-xl px-5 py-3 font-black transition ${currentPage === 'gallery' ? 'bg-gradient-to-br from-cyan-200 via-white to-slate-300 text-zinc-950' : 'bg-gradient-to-br from-slate-700 via-slate-900 to-black text-white hover:bg-white/10'}`}>🖼️ Galería</button>
                </nav>
            </div>
        </header>
    );
}

function GroupsScreen({ onOpenGroup }) {
    return (
        <section>
            <SectionTitle eyebrow="Carpetas" title="Personajes" description="Elige un grupo para ver sus personajes y administrar sus fichas." />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {GROUPS.map(group => (
                    <button key={group.id} onClick={() => onOpenGroup(group.id)} className={`metal-button illuminated-card rounded-3xl bg-gradient-to-br ${group.button} p-8 text-left transition hover:-translate-y-1 hover:scale-[1.02]`}>
                        <span className="text-5xl">{group.emoji}</span>
                        <h2 className="letter-relief mt-8 text-3xl uppercase tracking-wide">{group.label}</h2>
                        <p className="mt-2 text-sm font-semibold text-white/80">Abrir grupo</p>
                    </button>
                ))}
            </div>
        </section>
    );
}

function GroupScreen({ group, characters, onBack, onAdd, onOpen }) {
    return (
        <section>
            <HeaderBar title={`${group.emoji} ${group.label}`} subtitle={`${characters.length} personaje(s) en este grupo`} onBack={onBack} actionLabel="Agregar Personaje" onAction={onAdd} />
            {characters.length === 0 ? <EmptyState title="No hay personajes todavía" text="Agrega el primer personaje de este grupo con el botón de la cabecera." /> : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {characters.map(character => <CharacterCard key={character.id} character={character} onClick={() => onOpen(character.id)} />)}
                </div>
            )}
        </section>
    );
}

function CharacterCard({ character, onClick }) {
    const group = getGroup(character.group);
    return (
        <button onClick={onClick} className={`metal-card metal-shadow illuminated-card rounded-3xl border-2 ${group.border} ${group.glow} overflow-hidden text-left transition hover:-translate-y-1`} style={{ boxShadow: `0 0 0 1px ${group.color}55, 0 20px 50px rgba(0,0,0,.38), inset 0 1px 1px rgba(255,255,255,.35)` }}>
            <div className="relative h-72 overflow-hidden">
                <img src={character.photo || fallbackPhoto} alt={character.name} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5">
                    <h3 className="letter-relief texture-text line-clamp-1 text-4xl uppercase tracking-tight">{character.name}</h3>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 text-sm font-bold text-zinc-200">
                <span>🌎 {character.country || 'Sin país'}</span>
                <span>🎂 {calculateAge(character.birthDate) || '—'} años</span>
            </div>
        </button>
    );
}

function ProfileScreen({ character, mediaCount, onBack, onGallery, onEdit, onDelete }) {
    const group = getGroup(character.group);
    return (
        <section>
            <HeaderBar title="Ficha de personaje" subtitle={group.label} onBack={onBack} />
            <article className={`metal-card metal-shadow illuminated-card mx-auto max-w-4xl overflow-hidden rounded-[2rem] border-2 ${group.border}`}>
                <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_1.2fr]">
                    <div className="bg-black/35 p-5">
                        <img src={character.photo || fallbackPhoto} alt={character.name} className="h-[32rem] w-full rounded-[1.5rem] object-cover" />
                    </div>
                    <div className="flex flex-col gap-6 p-6 md:p-8">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[.3em]" style={{ color: group.color }}>{group.emoji} {group.label}</p>
                            <h2 className="letter-relief texture-text mt-3 text-6xl uppercase leading-none">{character.name}</h2>
                        </div>
                        <dl className="grid gap-3 text-base sm:grid-cols-2">
                            <Info label="Fecha de nacimiento" value={character.birthDate || '—'} />
                            <Info label="Edad" value={`${calculateAge(character.birthDate) || '—'} años`} />
                            <Info label="País de nacimiento" value={character.country || '—'} />
                            <Info label="Ciudad de nacimiento" value={character.city || '—'} />
                            <Info label="Altura" value={character.height || '—'} />
                            <Info label="Multimedia" value={`${mediaCount} archivo(s)`} />
                        </dl>
                        <div className="mt-auto grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                            <button onClick={onGallery} className="metal-button rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-900 px-6 py-4 text-lg font-black">📷 Galería de personaje</button>
                            <button onClick={onEdit} title="Editar" className="metal-button rounded-2xl bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-700 px-5 py-4 text-2xl">✏️</button>
                            <button onClick={onDelete} title="Eliminar" className="metal-button rounded-2xl bg-gradient-to-br from-red-300 via-red-600 to-red-950 px-5 py-4 text-2xl">🗑️</button>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    );
}

function CharacterGallery({ character, items, onBack, onAdd }) {
    return (
        <section>
            <HeaderBar title={`Galería de ${character.name}`} subtitle="Archivos del personaje" onBack={onBack} actionLabel="Agregar archivo" onAction={onAdd} />
            <MediaGrid items={items.map(item => ({ ...item, character }))} emptyText="Este personaje todavía no tiene multimedia." />
        </section>
    );
}

function GeneralGallery({ items }) {
    return (
        <section>
            <SectionTitle eyebrow="Galería general" title="Toda la multimedia" description="Aquí se muestran todos los archivos cargados para todos los personajes." />
            <MediaGrid items={items} emptyText="No hay archivos en la galería general." />
        </section>
    );
}

function MediaGrid({ items, emptyText }) {
    if (!items.length) return <EmptyState title="Galería vacía" text={emptyText} />;
    return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(item => (
                <figure key={item.id} className="metal-card metal-shadow illuminated-card overflow-hidden rounded-3xl border border-white/20">
                    {item.type === 'video' ? <video src={item.src} controls className="h-72 w-full bg-black object-cover" /> : <img src={item.src} alt={item.caption || item.character.name} className="h-72 w-full object-cover" />}
                    <figcaption className="letter-relief texture-text p-4 text-center text-2xl">{item.character.name}</figcaption>
                </figure>
            ))}
        </div>
    );
}

function CharacterFormModal({ initial, onClose, onSave }) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
    const age = calculateAge(form.birthDate);
    const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const onFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setField('photo', await fileToDataUrl(file));
    };
    const submit = (event) => {
        event.preventDefault();
        if (!form.name.trim()) return alert('El nombre es obligatorio.');
        onSave({ ...form, name: form.name.trim() });
    };
    return (
        <Modal title={form.id ? 'Editar personaje' : 'Agregar Personaje'} onClose={onClose}>
            <form onSubmit={submit} className="grid gap-4">
                <Input label="Nombre" value={form.name} onChange={value => setField('name', value)} required />
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Fecha de nacimiento" type="date" max={todayISO()} value={form.birthDate} onChange={value => setField('birthDate', value)} />
                    <Input label="Edad automática" value={age !== '' ? `${age} años` : ''} readOnly placeholder="Se calcula con la fecha" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="País de nacimiento" value={form.country} onChange={value => setField('country', value)} />
                    <Input label="Ciudad de nacimiento" value={form.city} onChange={value => setField('city', value)} />
                </div>
                <Input label="Altura" value={form.height} onChange={value => setField('height', value)} placeholder="Ej: 1.70 m" />
                <Input label="Foto por URL" type="url" value={form.photo.startsWith('data:') ? '' : form.photo} onChange={value => setField('photo', value)} placeholder="https://..." />
                <label className="grid gap-2 text-sm font-bold text-zinc-200">Foto desde dispositivo
                    <input type="file" accept="image/*" onChange={onFile} className="rounded-xl border border-white/20 bg-black/30 p-3 text-white shadow-inner outline-none focus:border-cyan-300" />
                </label>
                {form.photo && <img src={form.photo} alt="Vista previa" className="h-40 w-full rounded-2xl object-cover" />}
                <label className="grid gap-2 text-sm font-bold text-zinc-200">Grupo designado
                    <select value={form.group} onChange={event => setField('group', event.target.value)} className="rounded-xl border border-white/20 bg-zinc-900 p-3 text-white shadow-inner outline-none focus:border-cyan-300">
                        {GROUPS.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
                    </select>
                </label>
                <FormActions onClose={onClose} saveLabel="Guardar personaje" />
            </form>
        </Modal>
    );
}

function MediaFormModal({ character, onClose, onSave }) {
    const [src, setSrc] = useState('');
    const [type, setType] = useState('image');
    const onFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setType(file.type.startsWith('video') ? 'video' : 'image');
        setSrc(await fileToDataUrl(file));
    };
    const submit = (event) => {
        event.preventDefault();
        if (!src) return alert('Carga una URL o un archivo.');
        onSave({ characterId: character.id, src, type, caption: character.name });
    };
    return (
        <Modal title={`Agregar archivo a ${character.name}`} onClose={onClose}>
            <form onSubmit={submit} className="grid gap-4">
                <Input label="URL de archivo" type="url" value={src.startsWith('data:') ? '' : src} onChange={value => { setSrc(value); setType(/\.(mp4|webm|ogg)(\?|$)/i.test(value) ? 'video' : 'image'); }} placeholder="https://..." />
                <label className="grid gap-2 text-sm font-bold text-zinc-200">Archivo desde dispositivo
                    <input type="file" accept="image/*,video/*" onChange={onFile} className="rounded-xl border border-white/20 bg-black/30 p-3 text-white shadow-inner outline-none focus:border-cyan-300" />
                </label>
                {src && (type === 'video' ? <video src={src} controls className="h-56 rounded-2xl bg-black object-cover" /> : <img src={src} alt="Vista previa" className="h-56 rounded-2xl object-cover" />)}
                <FormActions onClose={onClose} saveLabel="Agregar archivo" />
            </form>
        </Modal>
    );
}

function HeaderBar({ title, subtitle, onBack, actionLabel, onAction }) {
    return (
        <div className="metal-panel metal-shadow chrome-border mb-6 flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
                {onBack && <button onClick={onBack} className="metal-button rounded-2xl bg-gradient-to-br from-slate-500 via-slate-800 to-black px-4 py-3 font-black hover:bg-white/20">←</button>}
                <div><h2 className="letter-relief text-4xl">{title}</h2><p className="text-sm font-semibold text-cyan-100/80">{subtitle}</p></div>
            </div>
            {actionLabel && <button onClick={onAction} className="metal-button rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-600 to-blue-950 px-5 py-4 font-black">＋ {actionLabel}</button>}
        </div>
    );
}

function SectionTitle({ eyebrow, title, description }) {
    return <div className="metal-panel metal-shadow chrome-border mb-6 rounded-3xl p-6"><p className="text-sm font-black uppercase tracking-[.35em] text-cyan-200">{eyebrow}</p><h2 className="cartoon-title mt-2 text-5xl sm:text-6xl">{title}</h2><p className="mt-2 max-w-2xl text-cyan-50/75">{description}</p></div>;
}

function EmptyState({ title, text }) {
    return <div className="metal-panel metal-shadow chrome-border rounded-3xl border border-dashed border-white/20 p-12 text-center"><h3 className="letter-relief text-3xl">{title}</h3><p className="mt-2 text-cyan-50/75">{text}</p></div>;
}

function Info({ label, value }) {
    return <div className="metal-card metal-shadow rounded-2xl border border-white/20 p-4"><dt className="text-xs font-black uppercase tracking-widest text-cyan-100/65">{label}</dt><dd className="letter-relief mt-1 text-2xl">{value}</dd></div>;
}

function Input({ label, value, onChange, type = 'text', ...props }) {
    return (
        <label className="grid gap-2 text-sm font-bold text-zinc-200">{label}
            <input type={type} value={value} onChange={event => onChange?.(event.target.value)} className="rounded-xl border border-white/20 bg-black/30 p-3 text-white shadow-inner outline-none focus:border-cyan-300" {...props} />
        </label>
    );
}

function Modal({ title, children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="metal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/20 p-5 metal-shadow">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="letter-relief text-3xl">{title}</h2>
                    <button onClick={onClose} className="metal-button rounded-full bg-gradient-to-br from-slate-500 via-slate-800 to-black px-4 py-2 font-black hover:bg-white/20">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function FormActions({ onClose, saveLabel }) {
    return <div className="mt-2 grid gap-3 sm:grid-cols-2"><button type="button" onClick={onClose} className="metal-button rounded-2xl bg-gradient-to-br from-slate-500 via-slate-800 to-black px-5 py-4 font-black hover:bg-white/20">Cancelar</button><button type="submit" className="metal-button rounded-2xl bg-gradient-to-br from-emerald-300 via-emerald-600 to-emerald-950 px-5 py-4 font-black">{saveLabel}</button></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
