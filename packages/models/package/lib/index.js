'use strict';

const { resolve } = require('path');
const fse = require('fs-extra');
const npminstall = require('npminstall');
const pathExists = require('path-exists').sync;
const pkgDirSync = require('pkg-dir').sync;
const { isObject } = require('@znomi/helper');
const formatPath = require('@znomi/format-path');
const { getDefaultRegistry, getNpmLatestVersion } = require('@znomi/get-npm-info');

class Package {
  constructor(options) {
    if (!options || !isObject(options)) {
      throw new Error('Package类的options必须是对象');
    }
    // 文件路径
    this.targetPath = options.targetPath;
    // 包版本
    this.packageVersion = options.packageVersion;
    // 包名称
    this.packageName = options.packageName;
    // 缓存路径
    this.storeDir = options.storeDir;
    // 包缓存目录前缀，实际的目录名称格式为_@znomi-cli_init@1.1.3@@znomi-cli
    this.cacheDirPrefix = this.packageName.replace('/', '_');
  }

  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      // 如果缓存路径不存在，则需要先创建
      fse.mkdirpSync(this.storeDir);
    }

    if (this.packageVersion === 'latest') {
      // 如果版本号设置为latest,需要获取所对应的版本号
      const version = await getNpmLatestVersion(this.packageName);
      this.packageVersion = version;
    }
  }

  // 获取包完整缓存路径
  get cacheFilePath() {
    return this.getCacheFilePathByVersion(this.packageVersion);
  }

  // 根据版本号获取缓存路径
  getCacheFilePathByVersion(version) {
    return resolve(this.storeDir, `_${this.cacheDirPrefix}@${version}@${this.packageName}`);
  }

  // 判断Package是否存在
  async exists() {
    if (this.storeDir) {
      // 1. 获取包版本号，用于查找路径是否存在
      await this.prepare();
      // 2. 判断缓存路径中有没有该包，_@znomi-cli_init@1.1.3@@znomi-cli
      return pathExists(this.cacheFilePath);
    } else {
      // 本地文件
      return pathExists(this.targetPath);
    }
  }

  // 安装Package
  async install() {
    await npminstall({
      // 安装的根目录
      root: this.targetPath,
      // 依赖包混存的路径，一般为node_modules目录
      storeDir: this.storeDir,
      // 镜像源
      registry: getDefaultRegistry(),
      // 安装包信息
      pkgs: [
        {
          // npm包名称
          name: this.packageName,
          // 版本
          version: this.packageVersion,
        },
      ],
    });
  }

  // 更新Package
  async update() {
    await this.prepare();
    // 1. 判断最新版本号缓存路径是否存在
    const latestVersion = await getNpmLatestVersion(this.packageName);
    const latestFilePath = this.getCacheFilePathByVersion(latestVersion);
    if (pathExists(latestFilePath)) {
      this.packageVersion = latestVersion;
      return;
    }
    // 2. 如果不存在则安装最新版本号
    await npminstall({
      // 安装的根目录
      root: this.targetPath,
      // 依赖包混存的路径，一般为node_modules目录
      storeDir: this.storeDir,
      // 镜像源
      registry: getDefaultRegistry(),
      // 安装包信息
      pkgs: [
        {
          // npm包名称
          name: this.packageName,
          // 版本
          version: latestVersion,
        },
      ],
    });
    this.packageVersion = latestVersion;
  }

  // 获取Package入口文件
  getRootFilePath() {
    function getPath(targetPath) {
      // 1. 获取package.json所在目录  pkg-dir
      const pkgDirPath = pkgDirSync(targetPath);
      if (!pkgDirPath) {
        return null;
      }
      // 2. 读取package.json   require()
      const pkgPath = resolve(pkgDirPath, 'package.json');
      const pkg = require(pkgPath);
      // 3. main/lib  path
      if (!pkg || !pkg.main) {
        return null;
      }
      const filePath = resolve(pkgDirPath, pkg.main);
      // 4. 路径的兼容macOs/windows 自建format-path
      return formatPath(filePath);
    }

    if (this.storeDir) {
      // 如果是有缓存路径
      return getPath(this.cacheFilePath);
    } else {
      // 本地文件
      return getPath(this.targetPath);
    }
  }
}

module.exports = Package;
