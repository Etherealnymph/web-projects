/* Static field geometry is rebuilt away from the animation thread. */
self.window = self;
importScripts('core.js', 'field.js');
self.onmessage = function (event) {
  const { id, defs, level } = event.data;
  try {
    const lines = FD.buildStreamlines(new FD.Sources(defs), level);
    self.postMessage({ id, lines });
  } catch (error) {
    self.postMessage({ id, error: String(error.message) });
  }
};
