const BASE_URL = 'https://exercisedb.p.rapidapi.com';
const API_KEY = process.env.REACT_APP_RAPIDAPI_KEY || '';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}
function setCached(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function apiFetch(path, cacheKey) {
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
    },
  });
  if (!res.ok) throw new Error(`ExerciseDB error: ${res.status}`);
  const data = await res.json();
  setCached(cacheKey, data);
  return data;
}

export const getBodyPartList = () => apiFetch('/exercises/bodyPartList', 'edb_bodyparts');
export const getEquipmentList = () => apiFetch('/exercises/equipmentList', 'edb_equipment');
export const getExercises = (limit = 30, offset = 0) =>
  apiFetch(`/exercises?limit=${limit}&offset=${offset}`, `edb_all_${limit}_${offset}`);
export const getByBodyPart = (bodyPart, limit = 30, offset = 0) =>
  apiFetch(`/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}&offset=${offset}`, `edb_bp_${bodyPart}_${limit}_${offset}`);
export const getByEquipment = (equipment, limit = 30, offset = 0) =>
  apiFetch(`/exercises/equipment/${encodeURIComponent(equipment)}?limit=${limit}&offset=${offset}`, `edb_eq_${equipment}_${limit}_${offset}`);
export const searchByName = (name, limit = 30, offset = 0) =>
  apiFetch(`/exercises/name/${encodeURIComponent(name)}?limit=${limit}&offset=${offset}`, `edb_name_${name}_${limit}_${offset}`);
export const getExerciseById = (id) => apiFetch(`/exercises/exercise/${id}`, `edb_ex_${id}`);
