'use strict';

const { readdirSync } = require('fs')
const { resolve } = require('path')
const semver = require('semver')
const { emptyDirSync, ensureDirSync, copySync } = require('fs-extra')
const inquirer = require('inquirer')
const log = require('@znomi/log')
const Command = require('@znomi/command')
const { get } = require('@znomi/request')
const Package = require('@znomi/package')
const spawn = require('@znomi/spawn')
const loading = require('@znomi/loading')

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
            await this.generateTemplate()
        } catch(err) {
            log.error(err.message)
        }
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
            const type = await this.getType()
            return this.getProjectInfo(type)
        } catch(err) {
            log.error(err.message)
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
                        value: TYPE_PROJECT,
                    },
                    {
                        name: '组件',
                        value: TYPE_COMPONENT,
                    }
                ]
            }
        ])
        return type
    }

    /**
     * 获取模板类型对应名称
     * @param {*} type type 模板类型
     * @returns 
     */
    getTypeName(type) {
        switch(type) {
            case TYPE_PROJECT:
                return '项目'
            case TYPE_COMPONENT:
                return '组件'
        }
    }

    /**
     * 获取将要创建的项目的信息
     * @param {*} type 模板类型
     * @returns 
     */
    async getProjectInfo(type) {
        const typeName = this.getTypeName(type)
        // 项目类型
        const { projectName, projectVersion } = await inquirer.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: `请输入${typeName}名称`,
                validate: function (value) {
                    const done = this.async();
                    setTimeout(() => {
                        if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)$/.test(value)) {
                            done(`请输入合法的${typeName}名称，例如：a-b、a_b、abc等`)
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
                message: `请输入${typeName}版本号`,
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

    /**
     * 获取选中模板信息
     */
    async getTemplate() {
        const { npmName } = await inquirer.prompt([
            {
                type: 'list',
                name: 'npmName',
                message: '请选择模板',
                choices: this.getTemplateChoices()
            },
        ])
        this.currentTemplate = this.templates.find(item => item.npmName === npmName)
        return this.currentTemplate
    }

    /**
     * 获取模板选项列表
     */
     getTemplateChoices() {
        return this.templates.map(item => ({
            name: item.name,
            value: item.npmName
        }))
    }

    /**
     * 下载模板
     */
    async downloadTemplate() {        
        const currentTemplate = await this.getTemplate()
        const homePath = process.env.CLI_HOME_PATH
        const targetPath = resolve(homePath, 'templates')
        const storeDir = resolve(targetPath, 'node_modules')
        const pkg = new Package({
            targetPath,
            storeDir,
            packageName: currentTemplate.npmName,
            packageVersion: currentTemplate.npmVersion,
        })
        const isExists = await pkg.exists()
        
        if (isExists) {
            const spinner = loading('正在更新模板...')
            // 更新package
            await pkg.update()
            spinner.stop(true)
            log.success('更新模板成功')
        } else {
            const spinner = loading('正在下载模板...')
            // 安装package
            await pkg.install()
            spinner.stop(true)
            log.success('下载模板成功')
        } 
        this.pkg = pkg
    }

    /**
     * 格式化命令信息
     * @param {*} script 基本命令
     * @returns 
     */
    formatScript(script) {
        const [command, ...args] = script.split(' ').filter(Boolean)
        return { command, args }
    }

    /**
     * 执行模板配置的命令
     */
    execCommand(command, args) {
        return new Promise((resolve, reject) => {
            // 安装脚本
            const child = spawn(command, args, {
                cwd: process.cwd(),
                stdio: 'inherit'
            })
            child.on('error', (err) => {
                reject(err)
            })
            child.on('exit', (e) => {
                resolve(e)
            })
        })
    }

    /**
     * 生成模板
     */
    async generateTemplate() {
        // 获取模板缓存路径
        const templatePath = resolve(this.pkg.cacheFilePath, 'template')
        const targetPath = process.cwd()
        ensureDirSync(templatePath)
        copySync(templatePath, targetPath)
        log.success('创建模板成功')
        if (this.currentTemplate.installScript) {
            // 安装脚本
            const { command, args } = this.formatScript(this.currentTemplate.installScript)
            const err = await this.execCommand(command, args)
            if (!err) {
                log.success('安装依赖成功')
            } 
        }
        if (this.currentTemplate.serveScript) {
            // 运行项目
            const { command, args } = this.formatScript(this.currentTemplate.serveScript)
            const err = await this.execCommand(command, args)
            if (!err) {
                log.success('启动项目成功')
            } 
        }
    }
    
}

function init(argv) {
    new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand
