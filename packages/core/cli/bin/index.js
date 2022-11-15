#!/usr/bin/env node
const importLocal = require('import-local')

if (importLocal(__filename)) {
  require('@znomi/log').info('cli', '当前使用本地znomi-cli运行')
} else {
  require('../lib')(process.argv.slice(2))
}