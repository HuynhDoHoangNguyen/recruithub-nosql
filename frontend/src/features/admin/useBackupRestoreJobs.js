import { useCallback, useEffect, useRef, useState } from 'react';
import { adminBackupApi, backupApiError } from '../../api/adminBackupApi';
import { isRunning, readTrackedJobs, sessionKey } from './backupRestorePresentation';

// The parent keys this hook's component by canonical user ID: no cross-user responses.
export function useBackupRestoreJobs(userId) {
  const [jobs, setJobs] = useState(() => readTrackedJobs(userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const [pollVersion, setPollVersion] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const lifecycle = useRef(null);
  const currentJobs = useRef(jobs);
  useEffect(() => { currentJobs.current = jobs; }, [jobs]);
  useEffect(() => {
    const controller = new AbortController(); lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(sessionKey(userId), JSON.stringify(jobs.map(({ id, type }) => ({ id, type })))); } catch { /* tracking continues in memory */ }
  }, [jobs, userId]);

  const ids = jobs.map(job => `${job.type}:${job.id}`).join('|');
  useEffect(() => {
    if (!ids || blocked) return;
    const controller = new AbortController(); let timer, failures = 0;
    const poll = async () => {
      // Also fetch terminal jobs once on remount/retry to reconcile TTL/validation consumption.
      const targets = currentJobs.current.filter(job => !job.checked || isRunning(job));
      if (!targets.length) return;
      for (const job of targets) {
        try {
          const result = await adminBackupApi.status(job.id, job.type, controller.signal);
          if (controller.signal.aborted) return;
          failures = 0;
          setJobs(items => items.map(item => item.id === job.id ? { ...result, checked: true } : item));
        } catch (failure) {
          if (controller.signal.aborted) return;
          const status = failure.response?.status;
          const message = await backupApiError(failure);
          if (controller.signal.aborted) return;
          if ([401, 403].includes(status)) { setBlocked(true); setError(message); return; }
          failures++;
          setJobs(items => items.map(item => item.id === job.id ? { ...item, pollError: message,
            ...(status === 404 || status === 410 ? { status: status === 410 ? 'EXPIRED' : 'UNAVAILABLE', checked: true } : {}) } : item));
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, Math.min(10000, 2000 * 2 ** Math.min(failures, 3)));
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [ids, pollVersion, blocked]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const run = useCallback(async (type, operation) => {
    if (lock.current || blocked || currentJobs.current.some(isRunning)) return null;
    lock.current = true; setBusy(true); setError('');
    const signal = lifecycle.current.signal;
    try {
      const result = await operation(signal);
      if (signal.aborted) return null;
      const next = [{ id: result.job_id, type, status: result.status }, ...currentJobs.current].slice(0, 32);
      currentJobs.current = next; setJobs(next);
      return result.job_id;
    } catch (failure) {
      if (signal.aborted) return null;
      const message = await backupApiError(failure);
      if (!signal.aborted) {
        setError(message);
        if ([401, 403].includes(failure.response?.status)) setBlocked(true);
      }
      return null;
    } finally {
      lock.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }, [blocked]);
  const retry = useCallback(() => {
    setJobs(items => items.map(item => ({ ...item, checked: false, pollError: null })));
    setPollVersion(value => value + 1);
  }, []);
  return { jobs, busy: busy || jobs.some(isRunning), blocked, error, now, run, retry };
}
