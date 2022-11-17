'use strict';

const semver = require('semver');
const colors = require('colors');
const log = require('@znomi/log');

const LOWEST_VERSION = '16.0.0';

class Command {
  constructor(argv) {
    if (!argv || !argv.length) {
      throw new Error('参数不能为空');
    }
    if (!Array.isArray(argv)) {
      throw new Error('参数必须为对象');
    }
    this._argv = argv;
    const runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();
      chain = chain.then(() => {
        this.checkNodeVersion();
      });
      chain = chain.then(() => {
        this.initArgs();
      });
      chain = chain.then(() => {
        this.init();
      });
      chain = chain.then(() => {
        this.exec();
      });
      chain.catch((err) => {
        log.error(err.message);
      });
    });
  }

  /**
   * 检查Node版本号
   *
   */
  checkNodeVersion() {
    const lowestVersion = LOWEST_VERSION;
    // 获取当前Node版本
    const currentVersion = process.version;
    if (!semver.gte(currentVersion, lowestVersion)) {
      throw new Error(colors.red(`znomi-cli 需要安装 v${lowestVersion} 版本以上的Node.js`));
    }
  }

  initArgs() {
    this._cmd = this._argv[this._argv.length - 1];
    this._options = this._argv[this._argv.length - 2];
    this._argv = this._argv.slice(0, this._argv.length - 2);
  }

  init() {
    throw new Error('请先定义init方法');
  }

  exec() {
    throw new Error('请先定义exec方法');
  }
}

module.exports = Command;
