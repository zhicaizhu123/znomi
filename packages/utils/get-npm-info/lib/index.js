'use strict';

const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')


/**
 * 获取npm包信息
 *
 * @param {*} npmName npm包名称
 * @param {*} registry 镜像路径
 * @return {*} 
 */
function getNpmInfo(npmName, registry) {
    if (!npmName) {
        return null
    }
    registry = registry || getDefaultRegistry()
    const npmUrl = urlJoin(registry, npmName)
    return axios.get(npmUrl).then(res => {
        if (res.status === 200) {
            return res.data
        }
        return null
    }).catch((err) => {
        return Promise.reject(err)
    })
}


/**
 * 获取默认镜像源
 *
 * @param {boolean} [isOriginal=false] 是否使用默认的npm镜像源
 * @return {*} 
 */
function getDefaultRegistry(isOriginal = false) {
    return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}


/**
 * 获取npm包所有版本号
 *
 * @param {*} npmName npm包名称
 * @param {*} registry 镜像路径
 * @return {*} 
 */
async function getNpmVersions(npmName, registry) {
    const data = await getNpmInfo(npmName, registry)
    if (data) {
        return Object.keys(data.versions)
    } else {
        return []
    }
}


/**
 * 获取大于或等于提供的版本号的版本号列表
 *
 * @param {*} baseVersion 比对版本号
 * @param {*} versions 全部版本号列表
 * @return {*} 
 */
async function getSemverVersions(baseVersion, versions) {
    return versions
        .filter(version => semver.satisfies(version, `^${baseVersion}`))
        .sort((a, b) => semver.gt(b, a) ? 1 : -1)
}

/**
 * 获取大于或等于提供的版本号和npm信息的版本号列表
 *
 * @param {*} baseVersion 比对版本号
 * @param {*} npmName npm包名称
 * @param {*} registry 镜像路径
 * @return {*} 
 */
async function getNpmSemverVersion(baseVersion, npmName, registry) {
    const versions = await getNpmVersions(npmName, registry)
    const newVersions = await getSemverVersions(baseVersion, versions)
    if (newVersions && newVersions.length > 0) {
        return newVersions[0]
    }
}


/**
 * 获取包最新的版本号
 *
 * @param {*} npmName npm包名称
 * @param {*} registry 镜像路径
 * @return {*} 
 */
async function getNpmLatestVersion(npmName, registry) {
    const versions = await getNpmVersions(npmName, registry)
    if (!versions) return null
    const latestVersion = versions.sort((a, b) => semver.gt(b, a) ? 1 : -1)[0]
    return latestVersion
}

module.exports = { 
    getNpmInfo,
    getNpmVersions,
    getSemverVersions,
    getNpmSemverVersion,
    getDefaultRegistry,
    getNpmLatestVersion,
};


