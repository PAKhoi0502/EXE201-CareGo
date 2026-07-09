let vietmapPromise;

export const loadVietmap = () => {
  if (!vietmapPromise) {
    vietmapPromise = Promise.all([
      import("@vietmap/vietmap-gl-js/dist/vietmap-gl.js"),
      import("@vietmap/vietmap-gl-js/dist/vietmap-gl.css"),
    ]).then(([module]) => module.default || module);
  }

  return vietmapPromise;
};
