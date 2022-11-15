'use strict';

const log = require('@znomi/log')
const Command = require('@znomi/command')


class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || ''
        this.force = !!this._cmd.force
        log.verbose('projectName', this.projectName)
        log.verbose('force', this.force)
    }

    exec() {
        console.log('执行业务逻辑')
    }
}

function init(argv) {
    new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand
