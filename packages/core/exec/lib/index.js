'use strict';

const cp = require('child_process')
const { resolve } = require('path')
const log = require('@znomi/log')

const Package = require('@znomi/package');
const { stdout } = require('process');

const SETTINGS = {
    init: '@imooc-cli/init'
}

async function exec() {
    // 脚手架缓存目录
    const homePath = process.env.CLI_HOME_PATH
    // 安装包所属目录路径
    let targetPath = process.env.CLI_TARGET_PATH
    // 安装包缓存目录
    let storeDir = ''

    const cmdObj = arguments[arguments.length - 1]
    // 命令名称
    const cmdName = cmdObj.name()
    const packageName = SETTINGS[cmdName]
    const packageVersion = 'latest'
    
    let pkg
    if (!targetPath) {
        // 如果不是本地安装包
        targetPath = resolve(homePath, 'dependencies')
        storeDir = resolve(targetPath, 'node_modules')
        log.verbose('targetPath', targetPath)
        log.verbose('storeDir', storeDir)

        pkg = new Package({
            targetPath,
            storeDir,
            packageName,
            packageVersion
        })

        const isExists = await pkg.exists()
        if (isExists) {
            // 更新package
            await pkg.update()
        } else {
            // 安装package
            await pkg.install()
        }
    } else {
        // 本地文件
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion
        })
    }

    // 获取需要执行的文件路径
    const rootFile = pkg.getRootFilePath()
    if (rootFile) {
        try {
             // 运行
            // require(rootFile).call(null, Array.from(arguments))
            // 在node子进程中调用
            const args = Array.from(arguments)
            const cmd = args[args.length - 1]
            const o = Object.create(null)
            // cmd对象瘦身
            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
                    o[key] = cmd[key]
                }
            })
            args[args.length - 1] = o
            const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit'
            })
            child.on('error', (err) => {
                log.error(err.message)
                process.exit(1)
            })
            child.on('exit', (e) => {
                log.verbose('命令执行成功：' + e)
                process.exit(e)
            })
        } catch(err) {
            log.error(err.message)
        }
    }
}


// 兼容不同系统
function spawn(command, args, options) {
    const win32 = process.platform === 'win32'
    const cmd = win32 ? 'cmd' : command
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args
    return cp.spawn(cmd, cmdArgs, options || {})
}

module.exports = exec;