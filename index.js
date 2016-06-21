import {run} from '@cycle/xstream-run';
import {makeDOMDriver, div, input} from '@cycle/dom';
import xs from 'xstream';
import _ from 'lodash';
import uuid from 'node-uuid';

import timeDriver from './src/time-driver';
import mousePositionDriver from './src/mouse-position-driver';

const FRAME_RATE = 1000 / 60;

// subtract by 1 because otherwise the spawn point is the same as the mouse start
// position and the boids don't move until the mouse moves
const BOID_SPAWN_POINT = {
  x: window.innerWidth / 2 - 1,
  y: window.innerHeight / 2 - 1
};

const LIGHTNESS_MIN = 30;
const LIGHTNESS_MAX = 100;
const LIGHTNESS_RANGE = LIGHTNESS_MAX - LIGHTNESS_MIN;
const LIGHTNESS_FALLOFF = 800;

const SCALE_MIN = 0.05;
const SCALE_FACTOR = 30;

const BOID_COUNT = 200;
const FRICTION = 0.98;

function Boid () {
  return {
    position: Object.assign({}, BOID_SPAWN_POINT),
    velocity: {x: 0, y: 0},
    hue: 276,
    key: uuid.v4()
  };
}

function makeflock (count) {
  return _.range(count).map(Boid);
}

function renderBoid (boid, mousePosition) {
  const angle = Math.atan2(boid.velocity.y, boid.velocity.x);

  const speed = Math.abs(boid.velocity.x) + Math.abs(boid.velocity.y);

  const scale = SCALE_MIN + speed / SCALE_FACTOR;

  const distanceVector = {
    x: Math.abs(boid.position.x - mousePosition.x),
    y: Math.abs(boid.position.y - mousePosition.y)
  };

  const distanceToMouse = Math.sqrt(
    Math.pow(distanceVector.x, 2) +
    Math.pow(distanceVector.y, 2)
  );

  const lightness = LIGHTNESS_MIN + LIGHTNESS_RANGE * distanceToMouse / LIGHTNESS_FALLOFF;

  const style = {
    position: 'absolute',
    transform: `translate(${boid.position.x}px, ${boid.position.y}px) rotate(${angle}rad) scale(${scale})`,
    'border-color': `transparent transparent transparent hsl(${boid.hue}, 100%, ${lightness}%)`
  };

  return (
    div('.boid', {key: boid.key, style})
  );
}

function view (state) {
  const slider = (className, {value, min, max}) =>
    input(`.control ${className}`, {attrs: {type: 'range', value, min, max}});

  return (
    div('.flock', [
      div('.controls', [
        slider('.avoidance', state.weights.avoidance),
        slider('.avoidance-distance', state.weights.avoidanceDistance),
        slider('.mouse-position', state.weights.mousePosition),
        slider('.flock-centre', state.weights.flockCentre)
      ]),

      div('.boids', state.flock.map(boid => renderBoid(boid, state.mousePosition)))
    ])
  );
}

function sign (number) {
  if (number < 0) {
    return -1;
  } else if (number > 0) {
    return 1;
  }

  return 0;
}

function moveTowards (boid, delta, position, speed) {
  const distance = {
    x: position.x - boid.position.x,
    y: position.y - boid.position.y
  };

  const absoluteDistance = {
    x: Math.abs(distance.x),
    y: Math.abs(distance.y)
  };

  const normalizedDistance = normalizeVector(absoluteDistance);

  boid.velocity.x += normalizedDistance.x * sign(distance.x) * speed * delta;
  boid.velocity.y += normalizedDistance.y * sign(distance.y) * speed * delta;
}

function normalizeVector (vector) {
  const vectorLength = Math.abs(vector.x + vector.y);

  if (vectorLength === 0) {
    return {x: 0, y: 0};
  }

  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength
  };
}

function calculateFlockCentre (flock) {
  return {
    x: _.mean(_.map(flock, 'position.x')),
    y: _.mean(_.map(flock, 'position.y'))
  };
}

function moveAwayFromCloseBoids (boid, flock, avoidance, avoidanceDistance, delta) {
  flock.forEach(otherBoid => {
    if (boid === otherBoid) { return; }

    const distanceVector = {
      x: Math.abs(boid.position.x - otherBoid.position.x),
      y: Math.abs(boid.position.y - otherBoid.position.y)
    };

    const distance = Math.sqrt(
      Math.pow(distanceVector.x, 2) +
      Math.pow(distanceVector.y, 2)
    );

    if (distance < avoidanceDistance) {
      const distanceRatio = 1 - distance / avoidanceDistance;

      moveTowards(boid, delta, otherBoid.position, -avoidance * distanceRatio);
    }
  });
}

function makeWeightUpdateReducer$ (weightPropertyName, weight$) {
  return weight$.map(weight => {
    return function (state) {
      state.weights[weightPropertyName].value = weight;

      return state;
    };
  });
}

function updateBoid (boid, delta, mousePosition, flockCentre, flock, weights) {
  moveTowards(
    boid,
    delta,
    mousePosition,
    weights.mousePosition.value / 100
  );

  moveTowards(
    boid,
    delta,
    flockCentre,
    weights.flockCentre.value / 100
  );

  moveAwayFromCloseBoids(
    boid,
    flock,
    weights.avoidance.value / 100,
    weights.avoidanceDistance.value,
    delta
  );

  boid.position.x += boid.velocity.x * delta;
  boid.position.y += boid.velocity.y * delta;

  boid.velocity.x *= FRICTION / delta;
  boid.velocity.y *= FRICTION / delta;

  return boid;
}

function update (state, delta, mousePosition) {
  state.mousePosition = mousePosition;

  const flockCentre = calculateFlockCentre(state.flock);

  state.flock.forEach(boid => updateBoid(
    boid,
    delta,
    mousePosition,
    flockCentre,
    state.flock,
    state.weights
  ));

  return state;
}

function main ({DOM, Time, Mouse}) {
  const initialState = {
    flock: makeflock(BOID_COUNT),
    mousePosition: {x: 0, y: 0},

    weights: {
      avoidance: {value: 110, min: 50, max: 150},
      avoidanceDistance: {value: 50, min: 10, max: 100},
      flockCentre: {value: 20, min: 5, max: 50},
      mousePosition: {value: 50, min: 10, max: 100}
    }
  };

  const avoidanceSlider$ = DOM
    .select('.avoidance')
    .events('input')
    .map(ev => ev.target.value);

  const avoidanceDistanceSlider$ = DOM
    .select('.avoidance-distance')
    .events('input')
    .map(ev => ev.target.value);

  const mousePositionSlider$ = DOM
    .select('.mouse-position')
    .events('input')
    .map(ev => ev.target.value);

  const flockCentreSlider$ = DOM
    .select('.flock-centre')
    .events('input')
    .map(ev => ev.target.value);

  const updateAvoidanceWeight$ = makeWeightUpdateReducer$('avoidance', avoidanceSlider$);
  const updateAvoidanceDistanceWeight$ = makeWeightUpdateReducer$('avoidanceDistance', avoidanceDistanceSlider$);
  const updateMousePositionWeight$ = makeWeightUpdateReducer$('mousePosition', mousePositionSlider$);
  const updateFlockCentreWeight$ = makeWeightUpdateReducer$('flockCentre', flockCentreSlider$);

  const tick$ = Time.map(time => time.delta / FRAME_RATE);

  const update$ = Mouse.positions()
    .map(mousePosition => tick$.map(delta => state => update(state, delta, mousePosition)))
    .flatten();

  const reducer$ = xs.merge(
    update$,

    updateAvoidanceWeight$,
    updateAvoidanceDistanceWeight$,
    updateMousePositionWeight$,
    updateFlockCentreWeight$
  );

  const state$ = reducer$.fold((state, reducer) => reducer(state), initialState);

  return {
    DOM: state$.map(view)
  };
}

const drivers = {
  DOM: makeDOMDriver('.app'),
  Time: timeDriver,
  Mouse: mousePositionDriver
};

run(main, drivers);
