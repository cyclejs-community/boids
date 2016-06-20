import {run} from '@cycle/xstream-run';
import {makeDOMDriver, div} from '@cycle/dom';
import xs from 'xstream';

function main ({DOM}) {
  return {
    DOM: xs.of(div('hello world'))
  }
}

const drivers = {
  DOM: makeDOMDriver('.app')
}

run(main, drivers);
