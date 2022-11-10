#!/usr/bin/env node

const utils = require('@znomi/utils')

module.exports = core;

function core() {
    console.log(utils())
    return "Hello from core";
}

core()