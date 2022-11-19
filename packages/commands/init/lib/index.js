'use strict';

const { readdirSync } = require('fs');
const { resolve } = require('path');
const semver = require('semver');
const { emptyDirSync, ensureDirSync, copySync, writeFileSync } = require('fs-extra');
const inquirer = require('inquirer');
const log = require('@znomi/log');
const Command = require('@znomi/command');
const { get } = require('@znomi/request');
const Package = require('@znomi/package');
const spawn = require('@znomi/spawn');
const loading = require('@znomi/loading');
const ejs = require('ejs');
const glob = require('glob');
const kebabCase = require('kebab-case');

const TYPE = {
  /** 组件类型 */
  PROJECT: 1,
  /** 组件类型 */
  COMPONENT: 2,
  /** 库开发 */
  LIBRARY: 3,
};

const TYPE_NAME = {
  [TYPE.PROJECT]: '项目模板',
  [TYPE.COMPONENT]: '组件模板',
  [TYPE.LIBRARY]: 'Library模板',
};

class InitCommand extends Command {
  /**
   * 初始化
   */
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this._options.force;
    // 子进程执行，需要重新设置日志级别
    log.level = process.env.CLI_LOG_LEVEL || 'info';
    log.verbose('projectName', this.projectName);
    log.verbose('force', this.force);
  }

  /**
   * 执行命令
   */
  async exec() {
    try {
      // 1. 选择创建项目或组件
      this.projectInfo = await this.prepare();
      if (!this.projectInfo) return;
      await this.getTemplateList(this.projectInfo.type);
      if (!this.templates || !this.templates.length) {
        throw new Error('暂时没有可用模板');
      }
      // 2. 下载模板
      await this.downloadTemplate();
      // 3. 获取项目的基本信息
      await this.generateTemplate();
    } catch (err) {
      log.error(err.message);
    }
  }

  /**
   * 准备阶段
   */
  async prepare() {
    try {
      const localPath = process.cwd();
      // 判断当前目录是否为空
      const isEmpty = this.isDirEmpty(localPath);
      // 是否强制更新
      if (!isEmpty) {
        let ifContinue = false;
        if (!this.force) {
          const answers = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'ifContinue',
              message: '当前文件夹不为空，是否继续创建项目？',
              default: false,
            },
          ]);
          ifContinue = answers.ifContinue;
          if (!ifContinue) return;
        }

        if (ifContinue || this.force) {
          const { confirmDelete } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmDelete',
              message: '是否确认清空当前文件夹下的文件？',
              default: false,
            },
          ]);
          if (confirmDelete) {
            // 清空当前目录
            emptyDirSync(localPath);
          }
        }
      }
      const type = await this.getType();
      return this.getProjectInfo(type);
    } catch (err) {
      log.error(err.message);
    }
  }

  /**
   * 获取模板类型
   */
  async getType() {
    const { type } = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '请选择初始化类型',
        default: 0,
        choices: [
          {
            name: '项目',
            value: TYPE.PROJECT,
          },
          {
            name: '组件',
            value: TYPE.COMPONENT,
          },
          {
            name: 'Library',
            value: TYPE.LIBRARY,
          },
        ],
      },
    ]);
    return type;
  }

  /**
   * 检测名称是否合法
   * @param {*} value 名称字符串
   * @returns
   */
  checkName(value) {
    return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)$/.test(value);
  }

  /**
   * 获取将要创建的项目的信息
   * @param {*} type 模板类型
   * @returns
   */
  async getProjectInfo(type) {
    const typeName = TYPE_NAME[type];

    const promptOptions = [
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${typeName}版本号`,
        validate: function (value) {
          const done = this.async();
          setTimeout(() => {
            if (!semver.valid(value)) {
              done('请输入合法的版本号，例如：1.0.0');
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: (value) => (semver.valid(value) ? semver.valid(value) : value),
      },
      {
        type: 'input',
        name: 'projectDescription',
        message: `请输入${typeName}描述信息`,
      },
    ];

    if (!this.checkName(this.projectName)) {
      const checkName = this.checkName;
      // 如果输入的项目名称不合法或者为空
      promptOptions.unshift({
        type: 'input',
        name: 'projectName',
        message: `请输入${typeName}名称`,
        validate: function (value) {
          const done = this.async();
          setTimeout(() => {
            if (!checkName(value)) {
              done(`请输入合法的${typeName}名称，例如：a-b、a_b、abc等`);
              return;
            }
            done(null, true);
          }, 0);
        },
        filter: (value) => value,
      });
    }
    // 项目类型
    const { projectName, projectVersion, projectDescription } = await inquirer.prompt(
      promptOptions
    );
    const name = this.checkName(this.projectName) ? this.projectName : projectName;
    return { type, projectName: name, projectVersion, projectDescription };
  }

  /**
   *  判断给定的路径是否为空目录
   * @param {*} localPath 路径名称
   * @returns
   */
  isDirEmpty(localPath) {
    const files = readdirSync(localPath).filter(
      (file) => !file.startsWith('.') && !file.includes('node_modules')
    );
    return !files.length;
  }

  /**
   * 获取模板列表
   * @param {*} type 模板类型
   */
  async getTemplateList(type) {
    const { data } = await get('http://localhost:3000/api/templates/list', { type });
    this.templates = data;
  }

  /**
   * 获取选中模板信息
   */
  async getTemplate() {
    const { npmName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'npmName',
        message: '请选择模板',
        choices: this.getTemplateChoices(),
      },
    ]);
    this.currentTemplate = this.templates.find((item) => item.npmName === npmName);
    return this.currentTemplate;
  }

  /**
   * 获取模板选项列表
   */
  getTemplateChoices() {
    return this.templates.map((item) => ({
      name: item.name,
      value: item.npmName,
    }));
  }

  /**
   * 下载模板
   */
  async downloadTemplate() {
    const currentTemplate = await this.getTemplate();
    const homePath = process.env.CLI_HOME_PATH;
    const targetPath = resolve(homePath, 'templates');
    const storeDir = resolve(targetPath, 'node_modules');
    const pkg = new Package({
      targetPath,
      storeDir,
      packageName: currentTemplate.npmName,
      packageVersion: currentTemplate.npmVersion,
    });
    const isExists = await pkg.exists();
    const action = isExists ? '更新' : '下载';
    let spinner = loading(`正在${action}模板...`);
    try {
      if (isExists) {
        // 更新package
        await pkg.update();
      } else {
        // 安装package
        await pkg.install();
      }
      log.success(`${action}模板成功`);
      this.pkg = pkg;
    } catch (err) {
      throw err;
    } finally {
      spinner.stop(true);
    }
  }

  /**
   * 格式化命令信息
   * @param {*} script 基本命令
   * @returns
   */
  formatScript(script) {
    const [command, ...args] = script.split(' ').filter(Boolean);
    return { command, args };
  }

  /**
   * 执行模板配置的命令
   * @param {*} command 命令
   * @param {*} args 命令参数
   * @returns
   */
  execAsync(command, args) {
    return new Promise((resolve, reject) => {
      // 安装脚本
      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      child.on('error', (err) => {
        reject(err);
      });
      child.on('exit', (e) => {
        resolve(e);
      });
    });
  }

  /**
   * 执行命令
   * @param {*} script 需要执行命令
   * @param {*} successText 执行成功命令提示
   * @returns
   */
  async execCommand(script, successText) {
    if (!script) return;
    // 安装脚本
    const { command, args } = this.formatScript(script);
    const err = await this.execAsync(command, args);
    if (!err) {
      log.success(successText);
    }
  }

  /**
   * 获取需要动态渲染的信息
   */
  getRenderData() {
    const { projectName, projectVersion, projectDescription } = this.projectInfo;
    return {
      name: kebabCase(projectName),
      version: projectVersion,
      description: projectDescription,
    };
  }

  /**
   * 替换模板文件信息
   * @param {*} filePath 动态处理的文件路径
   * @param {*} data 动态渲染数据
   * @returns
   */
  ejsRender(filePath, data = {}) {
    return new Promise((resolve, reject) => {
      ejs.rejectTemplate(filePath, data, {}, (err, file) => {
        if (err) {
          reject(err);
        } else {
          writeFileSync(filePath, file);
          resolve(file);
        }
      });
    });
  }

  /**
   * 遍历更新模板文件信息
   * @param {*} targetPath 项目目录
   * @param {*} ignore 忽略处理文件规则
   * @returns
   */
  templateFilesRender(targetPath, ignore) {
    return new Promise((resolveTemplate, rejectTemplate) => {
      glob(
        '**/*',
        {
          ignore,
          nodir: true,
        },
        (err, files) => {
          if (err) {
            rejectTemplate(err);
          } else {
            const renderData = this.getRenderData();
            Promise.all(
              files.map((file) => {
                const filePath = resolve(targetPath, file);
                return this.ejsRender(filePath, renderData);
              })
            )
              .then(() => {
                resolveTemplate();
              })
              .catch((err) => {
                rejectTemplate(err);
              });
          }
        }
      );
    });
  }

  /**
   * 生成模板
   */
  async generateTemplate() {
    // 获取模板缓存路径
    const templatePath = resolve(this.pkg.cacheFilePath, 'template');
    // 获取当前目录路径
    const targetPath = process.cwd();
    // 如果模板目录不存在则创建模板目录
    ensureDirSync(templatePath);
    // 复制模板目录文件到当前目录
    copySync(templatePath, targetPath);
    const templateIgnore = this.currentTemplate.ejsIgnore || [];
    // 遍历更新模板文件信息
    const ignore = ['**/node_modules/**', ...templateIgnore];
    await this.templateFilesRender(targetPath, ignore);
    log.success('创建模板成功');
    // 安装脚本
    await this.execCommand(this.currentTemplate.installScript, '安装依赖成功');
    // 运行项目
    await this.execCommand(this.currentTemplate.serveScript, '启动项目成功');
  }
}

function init(argv) {
  new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
