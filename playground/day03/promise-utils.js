// Day 3 · Build: YOUR promiseAll and promisePool. You write both function bodies.
// Rule: don't use Promise.all / allSettled / race / any inside promiseAll.
// (Inside promisePool you MAY use your own promiseAll.)
// Check your work:
//   node --test playground/day03/promise-utils.test.js

/**
 * Works like Promise.all.
 * @param {Array<Promise<any> | any>} items  promises or plain values
 * @returns {Promise<any[]>} the values in INPUT order; rejects with the first error
 */
export function promiseAll(items) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(items) || items.length === 0) {
      return resolve([]);
    }

    const results = new Array(items.length);
    let completedCount = 0;
    let isRejected = false;

    items.forEach((item, index) => {
      Promise.resolve(item)
        .then((value) => {
          if (isRejected) return;
          results[index] = value;
          completedCount++;
          if (completedCount === items.length) {
            resolve(results);
          }
        })
        .catch((error) => {
          if (isRejected) return;
          isRejected = true;
          reject(error);
        });
    });
  });

  throw new Error('TODO: write promiseAll');
}

/**
 * Runs async tasks with at most `limit` of them running at the same time.
 * @param {Array<() => Promise<any>>} tasks  FUNCTIONS that start the work (not promises!)
 * @param {number} limit  the max number of tasks running at once
 * @returns {Promise<any[]>} the results in INPUT order; rejects with the first error
 */
export function promisePool(tasks, limit) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return resolve([]);
    }

    const results = new Array(tasks.length);
    let nextIndex = 0;
    let activeCount = 0;
    let completedCount = 0;
    let isRejected = false;

    function runNext() {
      if (isRejected) return;

      if (completedCount === tasks.length) {
        return resolve(results);
      }

      while (activeCount < limit && nextIndex < tasks.length) {
        const currentIndex = nextIndex++;
        activeCount++;

        const taskFn = tasks[currentIndex];

        Promise.resolve()
          .then(() => taskFn())
          .then((res) => {
            if (isRejected) return;
            results[currentIndex] = res;
            activeCount--;
            completedCount++;
            runNext();
          })
          .catch((err) => {
            if (isRejected) return;
            isRejected = true;
            reject(err);
          });
      }
    }

    runNext();
  });
  throw new Error('TODO: write promisePool');
}
