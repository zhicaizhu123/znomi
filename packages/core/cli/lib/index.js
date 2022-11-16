'use strict';

module.exports = core;

const path =require('path')
const colors = require('colors/safe')
const semver = require('semver')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const commander = require('commander')
const log = require('@znomi/log')
const { getNpmSemverVersion } = require('@znomi/get-npm-info')
const exec = require('@znomi/exec')
const pkg = require('../package.json')
const constant = require('./const')

const program = new commander.Command()

/**
 * 是否为调试模式
 *
 * @return {*} 
 */
function isDebug() {
    return process.env.CLI_LOG_LEVEL === 'verbose'
}

async function core() {
    try {
        // 脚手架准备阶段
        await prepare()
        // 注册命令
        registerCommand()
    } catch(err) {
        log.error(err.message)
        if (isDebug) {
            // 调试模式展示完成错误信息
            console.log(err)
        }
    }
}

async function prepare() {
    // 1. 检查版本号
    checkVersion()
    // 2.检查root启动并降级
    checkRoot()
    // 3. 检查用户主目录
    checkUserHome()
    // 4. 检查环境变量
    checkEnv()
    // 5. 检查是否为最新版本
    await checkGlobalUpdate()
}


/**
 * 检查版本号
 *
 */
function checkVersion() {
    log.info('CLI version', pkg.version)
}

/**
 * 检查root启动并自动降级
 *
 */
function checkRoot() {
    const rootCheck = require('root-check')
    rootCheck()
}


/**
 * 检测用户主目录
 *
 */
function checkUserHome() {
    if (!userHome || !pathExists(userHome)) {
        throw new Error(colors.red('用户主目录不存在'))
    }
}


/**
 * 检查环境变量
 *
 */
function checkEnv() {
    const dotEnv = require('dotenv')
    const dotEnvPath = path.resolve(userHome, '.env')
    if (pathExists(dotEnvPath)) {
        dotEnv.config({
            path: dotEnvPath
        })
    } else {
        createDefaultConfig()
    }
    log.verbose('cli home path', process.env.CLI_HOME_PATH)
}


/**
 * 创建默认环境标量信息
 *
 */
function createDefaultConfig() {
    const cliConfig = {
        home: userHome
    }
    if (process.env.CLI_HOME) {
        cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
    } else {
        cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome
}


/**
 * 检查是否为最新版本，如果不是则提示更新
 *
 */
async function checkGlobalUpdate() {
    // 1. 获取当前版本号和模块名称
    // 2. 调用npm api,获取所有版本号
    // 3. 提取版本号，比对那些版本是大于当前版本号的
    // 4. 获取最新版本号，提示用户更新到该版本
    const currentVersion = pkg.version
    const npmName = pkg.name
    // TODO: 替换成npmName
    const lastVersion = await getNpmSemverVersion(currentVersion, '@imooc-cli/core')
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
        log.warn('更新提示：', colors.yellow(`请手动更新 ${npmName}，当前版本：${currentVersion}， 最新版本：${lastVersion}， 更新命令：npm install -g ${npmName}`))
    }
}


/**
 * 命令注册
 *
 */
function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>', '是否使用调试文件路径')

    // 如果开启debug，则可以打印调试的日志
    program.on('option:debug', () => {
        const isDebug = program.getOptionValue('debug')
        process.env.CLI_LOG_LEVEL = isDebug ? 'verbose' : 'info'
        log.level = process.env.CLI_LOG_LEVEL
    })

    // 如果传递了targetPath参数，则使用调试文件路径
    program.on('option:targetPath', () => {
       process.env.CLI_TARGET_PATH = program.getOptionValue('targetPath')
    })

    // 判断命令是否可用
    program.on('command:*', (obj) => {
        const availableCommands = program.commands.map(item => item.name)
        log.error('未知命令', obj[0])

        if (availableCommands.length) {
            log.info('可用命令', availableCommands.join(', '))
        }
    })

    // 初始化项目命令
    program
        .command('init <projectName>')
        .description('初始化项目')
        .option('-f, --force', '是否强制初始化项目')
        .action(exec)
    
    
    program.parse(process.argv)

    // 如果没有输入任何命令打印帮助文档
    if (program.args && program.args.length < 1) {
        program.outputHelp()
    }
}