import {run} from '@cycle/xstream-run';
import {makeDOMDriver, div} from '@cycle/dom';
import xs from 'xstream';
import _ from 'lodash';
import uuid from 'node-uuid';

import timeDriver from './src/time-driver';

// given we have a whole bunch of boids
// every frame
//  apply these rules:
//    - each boid moves away from any boids that are too close
//    - each boid moves towards the centre of the flock
//    - each boid moves towards the mouse

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

function update (state, delta) {
  return state;
}

function main ({DOM, Time}) {
  const initialState = {
    boids: makeBoids(10)
  };

  const tick$ = Time.map(time => time.delta);

  const state$ = tick$.fold((state, delta) => update(state, delta), initialState);

  return {
    DOM: state$.map(view)
  };
}

const drivers = {
  DOM: makeDOMDriver('.app'),
  Time: timeDriver
};

run(main, drivers);
