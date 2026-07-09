import { useCallback, useEffect, useRef, useState } from "react";

export const useAsync = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  const depsRef = useRef(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      depsRef.current = null;
    };
  }, []);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    if (!mountedRef.current) return undefined;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const result = await loaderRef.current();
      if (mountedRef.current && requestId === requestIdRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setError(err.message);
      }
      return undefined;
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const previousDeps = depsRef.current;
    const depsChanged =
      !previousDeps ||
      previousDeps.length !== deps.length ||
      deps.some((dependency, index) => !Object.is(dependency, previousDeps[index]));

    if (depsChanged) {
      depsRef.current = deps;
      reload();
    }
  });

  return { data, setData, loading, error, reload };
};
