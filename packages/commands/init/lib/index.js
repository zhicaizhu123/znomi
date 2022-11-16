'use strict';

const { readdirSync } = require('fs')
const semver = require('semver')
const { emptyDirSync } = require('fs-extra')
const inquirer = require('inquirer')
const log = require('@znomi/log')
const Command = require('@znomi/command')

// 项目类型
const TYPE_PROJECT = 1
// 组件类型
const TYPE_COMPONENT = 2

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || ''
        this.force = !!this._options.force
        // 子进程执行，需要重新设置日志级别
        log.level = process.env.CLI_LOG_LEVEL || 'info'
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    async exec() {
        try {
            // 1. 判断当前目录是否为空
            // 2. 是否强制更新  
            await this.prepare()
            // 3. 选择创建项目或组件
            // 4. 获取项目的基本信息
        } catch(err) {
            log.error(err.message)
        }
        
        // 
    }

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
            console.log('项目类型')
            const { projectName, projectVersion } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: '请输入项目名称',
                    default: '',
                    validate: (value) => /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)$/.test(value),
                    filter: (value) => value,
                },
                {
                    type: 'input',
                    name: 'projectVersion',
                    message: '请输入项目版本号',
                    default: '',
                    validate: (value) => !!semver.valid(value),  
                    filter: (value) => semver.valid(value) ? semver.valid(value) : value,
                }
            ])
        } else if (type === TYPE_COMPONENT) {
            console.log('组件类型')
        }
    }

    isDirEmpty(localPath) {
        const files = readdirSync(localPath).filter(file => !file.startsWith('.') && !file.includes('node_modules'))
        return !files.length
    }
}

function init(argv) {
    new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand
