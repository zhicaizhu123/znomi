'use strict';

const { sep } = require('path')

function formatPath(path) {
    if (typeof path !== 'string') {
        return path
    }
    if (sep === '/') {
        // macOS系统
        return path
    }
    // windows系统
    return path.replace(/\\/g, '/')
}

module.exports = formatPath;