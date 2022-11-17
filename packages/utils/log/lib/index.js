'use strict';

const log = require('npmlog');

// 日志前缀
log.heading = 'znomi-cli';

// 日志前缀样式
log.headingStyle = { fg: 'white', bg: 'blue' };

// 自定义日志命令
log.addLevel('success', 2000, { fg: 'green', bold: true });

module.exports = log;
