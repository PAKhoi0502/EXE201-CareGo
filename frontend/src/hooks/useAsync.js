import { useCallback, useEffect, useRef, useState } from "react";

export const useAsync = (loader, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  const depsRef = useRef(null);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loaderRef.current();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
