import { useCallback, useEffect, useRef, useState } from 'react';

export function useApiResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const requestId = ++generation.current;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const data = await loader();
      if (generation.current === requestId) setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (generation.current === requestId) setState(previous => ({ ...previous, loading: false, error }));
      return null;
    }
  }, [loader]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { reload(); return invalidate; }, [reload, invalidate]);
  return { ...state, reload };
}

export function useBookmarkPage() {
  const [bookmarks, setBookmarks] = useState([undefined]);
  return { bookmark: bookmarks.at(-1), page: bookmarks.length,
    next: value => setBookmarks(previous => [...previous, value]),
    previous: () => setBookmarks(previous => previous.slice(0, -1)), reset: () => setBookmarks([undefined]) };
}
