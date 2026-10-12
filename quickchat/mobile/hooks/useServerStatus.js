import { useCallback, useEffect, useState } from 'react';

import { getHealth } from '../services/api';

export function useServerStatus() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getHealth();
      setData(result);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { loading, data, error, refresh: check };
}
