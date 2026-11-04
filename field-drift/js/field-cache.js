(function () {
  'use strict';
  const FD = window.FD;
  let worker = null,
    active = null,
    pending = null,
    serial = 0,
    disabled = false;
  function complete(lines) {
    const task = active;
    active = null;
    if (task.id === serial) task.done(lines);
    dispatch();
  }
  function fallback() {
    disabled = true;
    if (worker) worker.terminate();
    worker = null;
    const task = pending || active;
    pending = null;
    active = task;
    setTimeout(function () {
      if (task) complete(FD.buildStreamlines(task.sources, task.level));
    }, 0);
  }
  function dispatch() {
    if (active || !pending) return;
    active = pending;
    pending = null;
    if (disabled || !window.Worker || location.protocol === 'file:') {
      fallback();
      return;
    }
    try {
      if (!worker) {
        worker = new Worker('js/field-worker.js');
        worker.onmessage = function (event) {
          if (!active || event.data.id !== active.id) return;
          if (event.data.error) fallback();
          else complete(event.data.lines);
        };
        worker.onerror = fallback;
      }
      worker.postMessage({
        id: active.id,
        defs: active.sources.raw,
        level: { bounds: active.level.bounds },
      });
    } catch (error) {
      fallback();
    }
  }
  FD.requestLines = function (sources, level, done) {
    pending = { id: ++serial, sources, level, done };
    dispatch();
  };
})();
