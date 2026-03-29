import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExerciseDetails() {
  const navigate = useNavigate();

  useEffect(() => {
    // Detail is shown in-sheet inside the library — redirect there
    navigate('/exercises', { replace: true });
  }, [navigate]);

  return null;
}
