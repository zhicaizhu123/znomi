'use strict';

const { readdirSync } = require('fs')
const { resolve } = require('path')
const semver = require('semver')
const { emptyDirSync } = require('fs-extra')
const inquirer = require('inquirer')
const log = require('@znomi/log')
const Command = require('@znomi/command')
const { get } = require('@znomi/request')
const Package = require('@znomi/package')

// 项目类型
const TYPE_PROJECT = 1
// 组件类型
const TYPE_COMPONENT = 2

class InitCommand extends Command {
    /**
     * 初始化
     */
    init() {
        this.projectName = this._argv[0] || ''
        this.force = !!this._options.force
        // 子进程执行，需要重新设置日志级别
        log.level = process.env.CLI_LOG_LEVEL || 'info'
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    /**
     * 执行命令
     */
    async exec() {
        try {
            // 1. 选择创建项目或组件
            this.projectInfo = await this.prepare()
            await this.getTemplateList(this.projectInfo.type)
            if (!this.templates || !this.templates.length) {
                throw new Error('暂时没有可用模板')
            }
            // 2. 下载模板
            await this.downloadTemplate()
            // 3. 获取项目的基本信息
        } catch(err) {
            log.error(err.message)
        }
        
        // 
    }
    
    /**
     * 准备阶段
     */
    async prepare() {
        try {
            const localPath = process.cwd()
            // 判断当前目录是否为空
            const isEmpty = this.isDirEmpty(localPath)
            // 是否强制更新  
            if (!isEmpty) {
                let ifContinue = false
                if (!this.force) {
                    const answers= await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'ifContinue',
                            message: '当前文件夹不为空，是否继续创建项目？',
                            default: false
                        }
                    ])
                    ifContinue = answers.ifContinue
                    if (!ifContinue) return
                }
                
                if (ifContinue || this.force) {
                    const { confirmDelete } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirmDelete',
                            message: '是否确认清空当前文件夹下的文件？',
                            default: false
                        }
                    ])
                    if (confirmDelete) {
                        // 清空当前目录
                        emptyDirSync(localPath)
                    }
                }
            }
            return this.getProjectInfo()
        } catch(err) {
            log.error(err.message)
        }
    }

    /**
     * 获取将要创建的项目的信息
     */
    async getProjectInfo() {
        const { type } = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: '请选择初始化类型',
                default: 0,
                choices: [
                    {
                        name: '项目',
                        value: TYPE_PROJECT,
                    },
                    {
                        name: '组件',
                        value: TYPE_COMPONENT,
                    }
                ]
            }
        ])
        if (type === TYPE_PROJECT) {
            // 项目类型
            const { projectName, projectVersion } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: '请输入项目名称',
                    validate: function (value) {
                        const done = this.async();
                        setTimeout(() => {
                            if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)$/.test(value)) {
                                done('请输入合法的项目名册，例如：a-b、a_b、abc等')
                                return
                            }
                            done(null, true)
                        }, 0)
                    },
                    filter: (value) => value,
                },
                {
                    type: 'input',
                    name: 'projectVersion',
                    message: '请输入项目版本号',
                    validate: function (value) {
                        const done = this.async();
                        setTimeout(() => {
                            if (!semver.valid(value)) {
                                done('请输入合法的版本号，例如：1.0.0')
                                return
                            }
                            done(null, true)
                        }, 0)
                    },
                    filter: (value) => semver.valid(value) ? semver.valid(value) : value,
                }
            ])
            return { type, projectName, projectVersion }
        } else if (type === TYPE_COMPONENT) {
            // TODO: 组件类型
            return { type }
        }
    }

    /**
     *  判断给定的路径是否为空目录
     * @param {*} localPath 路径名称
     * @returns 
     */
    isDirEmpty(localPath) {
        const files = readdirSync(localPath).filter(file => !file.startsWith('.') && !file.includes('node_modules'))
        return !files.length
    }

    /**
     * 获取模板列表
     * @param {*} type 模板类型
     */
    async getTemplateList(type) {
        const templates = await get('http://localhost:3000/api/templates/list', { type })
        this.templates = templates
    }

    async downloadTemplate() {
        // 1. 从后台的项目列表选取项目模板
        const { npmName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'npmName',
                message: '请选择模板',
                choices: this.getTemplateChoices()
            },
        ])
        
        const currentTemplate = this.templates.find(item => item.npmName === npmName)
        // 2. 通过npm存储项目模板
        const homePath = process.env.CLI_HOME_PATH
        const targetPath = resolve(homePath, 'templates')
        const storeDir = resolve(targetPath, 'node_modules')
        const pkg = new Package({
            targetPath,
            storeDir,
            packageName: currentTemplate.npmName,
            packageVersion: currentTemplate.version,
        })
        const isExists = await pkg.exists()
        if (isExists) {
            // 更新package
            await pkg.update()
        } else {
            // 安装package
            await pkg.install()
        }
        // 3. 将项目模板存储到mongodb
        // 4. 通过nest.js 获取mongodb中的数据并通过API返回

    }

    getTemplateChoices() {
        return this.templates.map(item => ({
            name: item.name,
            value: item.npmName
        }))
    }
}

function init(argv) {
    new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand
