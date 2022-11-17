'use strict';

const axios = require('axios');

const instance = axios.create({
  // TODO: 替换链接
  baseURL: 'http://localhost:3000/api/',
  timeout: 3000,
});

instance.interceptors.response.use(
  (res) => {
    return res.data;
  },
  (err) => {
    return Promise.reject(err);
  }
);

function request(config) {
  return instance.request(config);
}

function get(url, data, config) {
  return instance.get(url, {
    params: data,
    ...config,
  });
}

function post(url, data, config) {
  return instance.post(url, data, config);
}

function ndelete(url, data, config) {
  return instance.delete(url, {
    params: data,
    ...config,
  });
}

function put(url, data, config) {
  return instance.put(url, data, config);
}

module.exports = {
  request,
  get,
  post,
  delete: ndelete,
  put,
};
