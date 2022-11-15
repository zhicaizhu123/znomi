# core 模块技术方案
## 命令执行流程
### 准备阶段
- 流程：
  1. 检查版本号 npmlog / import-local
  2. 检查node版本 semver
  3. 检查root启动 root-check
  4. 检查用户主目录 user-home / path-exists
  5. 检查入参 minimist
  6. 检查环境变量 dotenv
  7. 检查是否为最新版本 axios / url-join / semver
  8. 提示更新 
- 核心库：
  - import-local
  - commander
- 工具库
  - npmlog：打印日志(进行二次封装) *
  - fs-extra：文件操作
  - semver：比对版本号 *
  - colors：控制台打印日志颜色 *
  - user-home：用户主目录
  - dotenv：环境变量文件读取
  - root-check：root用户检查和降级
  - path-exists：判断路径是否存在
  - minimist：完成参数解析
  - pkg-dir: 查找package.json所在目录
  - npminstall: 安装依赖库

### 命令注册
#### 脚手架初始化和全局参数注册
```javascript
const commander = require('commander')

const program = new commander.Command()

function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
    
    // 如果开启debug，则可以打印调试的日志
    program.on('option:debug', () => {
        if (program.debug) {
            log.level = 'verbose'
        }
    })

    // 判断命令是否可用
    program.on('command:*', (obj) => {
        const availableCommands = program.commands.map(item => item.name)
        log.error('未知命令', obj[0])

        if (availableCommands.length) {
            log.info('可用命令', availableCommands.join(', '))
        }
    })

    program.parse(process.argv)

    // 如果没有输入任何命令打印帮助文档
    if (program.args && program.args.length < 1) {
        program.outputHelp()
    }
}
```

#### 注册命令
```javascript
function registerCommand() {
  ...
  // 初始化项目命令
  program
      .command('init <projectName>')
      .description('初始化项目')
      .option('-f, --force', '是否强制初始化项目')
      .action(init)
  ...
}
```

#### 动态执行命令



### 命令执行