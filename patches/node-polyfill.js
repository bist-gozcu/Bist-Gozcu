// Polyfills for Node v20 compatibility with Metro/expo (expects Node v22+)
const os = require('os');
if (!os.availableParallelism) {
  os.availableParallelism = function availableParallelism() {
    const cpus = os.cpus();
    return cpus ? cpus.length : 4;
  };
}

if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function toReversed() {
    return [...this].reverse();
  };
}

if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function toSorted(compareFn) {
    return [...this].sort(compareFn);
  };
}

if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function toSpliced(start, deleteCount, ...items) {
    return [...this.slice(0, start), ...items, ...this.slice(start + deleteCount)];
  };
}

if (!Array.prototype.with) {
  Array.prototype.with = function withMethod(index, value) {
    const copy = [...this];
    copy[index] = value;
    return copy;
  };
}
