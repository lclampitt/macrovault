import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExerciseById } from '../../lib/exercisedb';

export default function ExerciseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { navigate('/exercises'); return; }
    getExerciseById(id)
      .then((data) => setExercise(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading exercise…</div>
  );

  // Redirect back to library for now (detail is shown in-sheet in the library)
  navigate('/exercises');
  return null;
}
