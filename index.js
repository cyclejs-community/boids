import {run} from '@cycle/xstream-run';
import {makeDOMDriver, div} from '@cycle/dom';
import xs from 'xstream';
import _ from 'lodash';
import uuid from 'node-uuid';

import timeDriver from './src/time-driver';
import mousePositionDriver from './src/mouse-position-driver';

// given we have a whole bunch of boids
// every frame
//  apply these rules:
//    - each boid moves away from any boids that are too close
//    - each boid moves towards the centre of the flock
//    X each boid moves towards the mouse
//
const FRAME_RATE = 1000 / 60;

function Boid () {
  return {
    position: {x: 200, y: 200},
    key: uuid.v4()
  };
}

function makeBoids (count) {
  return _.range(count).map(Boid);
}

function renderBoid (boid) {
  const style = {
    position: 'absolute',
    transform: `translate(${boid.position.x}px, ${boid.position.y}px)`
  };

  return (
    div('.boid', {key: boid.key, style})
  );
}

function view (state) {
  return (
    div('.boids', state.boids.map(renderBoid))
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

function moveTowardsMouse(boid, delta, mousePosition) {
  const distanceToMouse = {
    x: mousePosition.x - boid.position.x,
    y: mousePosition.y - boid.position.y
  };

  const absoluteDistance = {
    x: Math.abs(distanceToMouse.x),
    y: Math.abs(distanceToMouse.y)
  };

  const normalizedDistance = normalizeVector(absoluteDistance);

  boid.position.x += normalizedDistance.x * sign(distanceToMouse.x) * delta;
  boid.position.y += normalizedDistance.y * sign(distanceToMouse.y) * delta;
}

function normalizeVector (vector) {
  const vectorLength = Math.abs(vector.x + vector.y);

  return {
    x: vector.x / vectorLength,
    y: vector.y / vectorLength
  };
}

function updateBoid (boid, delta, mousePosition) {
  moveTowardsMouse(boid, delta, mousePosition);

  return boid;
}

function update (state, delta, mousePosition) {
  state.boids.forEach(boid => updateBoid(boid, delta, mousePosition));

  return state;
}

function main ({DOM, Time, Mouse}) {
  const initialState = {
    boids: makeBoids(1)
  };

  const tick$ = Time.map(time => time.delta / FRAME_RATE);

  const update$ = Mouse.positions()
    .map(mousePosition => tick$.map(delta => state => update(state, delta, mousePosition)))
    .flatten();

  const state$ = update$.fold((state, reducer) => reducer(state), initialState);

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
