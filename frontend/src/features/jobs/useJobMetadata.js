import { useEffect, useState } from 'react';
import { jobApi } from '../../api/jobApplicationApi';

export function useJobMetadata() {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => jobApi.metadata()).then(data => {
      if (active) setState({ data, error: null, loading: false });
    }).catch(error => { if (active) setState({ data: null, error, loading: false }); });
    return () => { active = false; };
  }, []);
  return state;
}
