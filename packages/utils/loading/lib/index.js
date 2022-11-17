'use strict';

const colors = require('colors')

const Spinner = require('cli-spinner').Spinner;

function loading(text = '加载中...') {
    const spinner = new Spinner(colors.blue('%s ' + text));
    spinner.setSpinnerString('|/-\\');
    spinner.start();
    return spinner
}

module.exports = loading;
