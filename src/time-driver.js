import requestAnimationFrame from 'raf';
import now from 'performance-now';
import xs from 'xstream';

export default function timeDriver () {
  const animation$ = xs.create();

  let previousTime = now();

  function tick (timestamp) {
    animation$.shamefullySendNext({
      timestamp,
      delta: timestamp - previousTime
    });

    previousTime = timestamp;

    requestAnimationFrame(tick);
  }

  tick(previousTime);

  return animation$;
}

